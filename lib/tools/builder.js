const _ = require('the-lodash');
const spawn = require('cross-spawn');
const Promise = require('the-promise');
const tmp = require('tmp');
const Path = require('path');
const fs = require('fs');
const copy = require('recursive-copy');
const mkdirp = require('mkdirp');
const DependencyResolver = require('processing-tools/dependency-resolver');
const ArchiveTools = require('./archive-tools');
const HashTools = require('./hash-tools');
const Shell = require('./shell');


class Builder
{
    constructor(logger, registry, config, docker, screen)
    {
        this._logger = logger;
        this._registry = registry;
        this._config = config;
        this._docker = docker;
        this._screen = screen;
        this._rootTmpDir = null;
        this._shell = new Shell(logger, screen);
    }

    filterCluster(name)
    {
        this._cluster = name;
    }

    filterService(name)
    {
        this._service = name;
    }

    filterLambda(name)
    {
        this._lambda = name;
    }

    perform()
    {
        return Promise.resolve()
            .then(() => this._storeDefinitions())
            .then(() => this._processDockerBased())
            .then(() => this._processLambdaBased())
            ;
    }

    _storeDefinitions()
    {
        return Promise.resolve()
            .then(() => Promise.serial(this._registry.clusters(), x => this._storeClusterDefinition(x)))
    }

    _storeClusterDefinition(cluster)
    {
        var definitions = cluster.extractDefinitions();
        this._config.set('clusters', [cluster.name], definitions);
    }

    _processDockerBased()
    {
        return Promise.resolve()
            .then(() => Promise.serial(this._registry.image_based(), image => this._loadDockerFile(image)))
            .then(() => {
                var resolver = new DependencyResolver();
                var myImages = {};
                for (var item of this._registry.image_based()) {
                    myImages[item.image] = item;
                    resolver.add(item.image, item.baseImage);
                }

                var imagesToBuild = resolver.order.map(x => myImages[x]).filter(x => x);
                imagesToBuild = imagesToBuild.filter(x => this._shouldBuildImage(x));
                return Promise.serial(imagesToBuild, x => this._buildDockerImage(x));
            });
    }

    _shouldBuildImage(image)
    {
        if (this._cluster) {
            if (image.clusterName !== this._cluster) {
                return false;
            }
        }
        if (this._service) {
            if (image.name !== this._service) {
                return false;
            }
        }
        return true;
    }

    _buildDockerImage(item)
    {
        if (!item.hasDockerfile) {
            this._logger.warn('[_buildDockerImage] Missing dockerfile for %s.', item.id);
            return;
        }
        this._logger.info('[_buildDockerImage] Building docker image for %s....', item.id);
        this._logger.info('[_buildDockerImage] Item Class: %s...', item.constructor.name);
        this._logger.info('[_buildDockerImage] Build Path: %s', item.path);
        this._logger.info('[_buildDockerImage] Image Name: %s', item.image);

        var targetBuildPath = null;
        var dockerfile = null;
        var imageName = item.image; 
        return Promise.resolve()
            .then(() => this._getBuildTargetPath(item))
            .then(result => {
                targetBuildPath = result;
                dockerfile = Path.join(targetBuildPath, 'Dockerfile');

                this._logger.info('[_buildDockerImage] Build Path: %s', targetBuildPath);
                this._logger.info('[_buildDockerImage] DockerFile: %s', dockerfile);

                this._screen.info('Building docker image %s...', item.id);
                return this._docker.command('build -t ' + imageName + ' ' + targetBuildPath)
            })
            .then(result => {
                if (result.code != 0) {
                    throw new Error ('Could not build docker image for ' + item.image + '. Path: ' + dockerfile);
                } else {
                    this._logger.info('[_buildDockerImage] Image Build Completed');
                }
            })
            .then(() => this._docker.getImage(imageName))
            .then(result => {
                if (!result) {
                    throw new Error('Service image not built: ' + imageName);
                }
                var info = {
                    kind: 'docker',
                    name: imageName,
                    digest: result.Id
                }
                this._config.set('repository', [item.naming[0], item.id], info);
            })
            .catch(reason => {
                this._logger.error('Failed to build %s image...', item.id);
                this._screen.error('Failed to build %s image...', item.id);
            })
            ;
    }

    _loadDockerFile(image) {
        if (fs.existsSync(image.dockerfile)) {
            var dockerContents = fs.readFileSync(image.dockerfile, {encoding: 'utf8'});
            var result = dockerContents.match(/FROM ([\S]+)/);
            image.baseImage = result[1];
            image.hasDockerfile = true;
        } else {
            image.baseImage = null;
            image.hasDockerfile = false;
        }
    }

    _getBuildTargetPath(item)
    {
        if (item.extendSymlinks) {
            var newBuildPath = tmp.dirSync();
            var targetBuildPath = newBuildPath.name;
            this._screen.info('Copying %s to %s...', item.path, targetBuildPath);
            return copy(item.path, targetBuildPath, { expand: true })
                .then(() => targetBuildPath);
        } else {
            return item.path;
        }
    }

    _processLambdaBased()
    {
        return Promise.resolve()
            .then(() => this._registry.lambdas.filter(x => this._shouldBuildLambda(x)))
            .then(lambdas => Promise.serial(lambdas, x => this._buildLambda(x)))
            // .then(() => {
            //     var resolver = new DependencyResolver();
            //     var myImages = {};
            //     for (var item of this._registry.image_based()) {
            //         myImages[item.image] = item;
            //         resolver.add(item.image, item.baseImage);
            //     }

            //     var imagesToBuild = resolver.order.map(x => myImages[x]).filter(x => x);
            //     imagesToBuild = imagesToBuild.filter(x => this._shouldBuild(x));
            //     return Promise.serial(imagesToBuild, x => this._buildDockerImage(x));
            // });
    }

    _shouldBuildLambda(lambda)
    {
        if (this._cluster) {
            if (lambda.clusterName !== this._cluster) {
                return false;
            }
        }
        if (this._lambda) {
            if (lambda.name !== this._lambda) {
                return false;
            }
        }
        return true;
    }

    _buildLambda(lambda)
    {
        this._screen.info('Building lambda %s...', lambda.id);

        this._logger.info('[_buildLambda] Building lambda image for %s....', lambda.id);
        this._logger.info('[_buildLambda] Build Path: %s', lambda.path);

        var targetBuildPath = null;
        var zipChecksum = null;
        var outputDir = this._getTmpDir([lambda.clusterName, 'lambda', lambda.name]);
        mkdirp.sync(outputDir)
        var outputFilePath = Path.join(outputDir, 'code.zip')
        var origCodeDir = Path.join(lambda.path, 'src');
        return Promise.resolve()
            .then(() => this._execLambdaPreBuild(lambda, origCodeDir))
            .then(() => this._getBuildTargetPath(lambda))
            .then(result => {
                targetBuildPath = result;
                var codeDir = Path.join(targetBuildPath, 'src');
                this._screen.info('Compressing %s to %s...', codeDir, outputFilePath)
                return ArchiveTools.compressDirectoryToFile(codeDir, outputFilePath)
            })
            .then(() => {
                return HashTools.calculateSha256FromFile(outputFilePath)
            })
            .then(result => {
                this._screen.info('Lambda %s checksum = %s', lambda.id, zipChecksum)
                var checksum = 'sha256:' + result;
                this._config.set('repository', [lambda.naming[0], lambda.id], { kind: 'lambda', path: outputFilePath, digest: checksum});
            })
            ;
    }

    _execLambdaPreBuild(lambda, codeDir)
    {
        return Promise.resolve()
            .then(() => this._shell.runX('npm install --production', codeDir))
    }

    _getTmpDir(components) {
        if (!this._rootTmpDir) {
            this._rootTmpDir = tmp.dirSync();
        }
        var parts = _.flattenDeep([this._rootTmpDir.name, components])
        return Path.join.apply(null, parts)
    }
    
    _getLambdaDir(clusterName, lambdaName) {
        return this._getTmpDir([clusterName, 'lambda', lambdaName]);
    }

}

module.exports = Builder;
