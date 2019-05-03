const _ = require('the-lodash');
const Promise = require('the-promise');
const tmp = require('tmp');
const Path = require('path');
const fs = require('fs');
const fsCopy = Promise.promisify(fs.copyFile);
const DependencyResolver = require('processing-tools/dependency-resolver');
const JobRunner = require('./job-runner');
const Shell = require('./shell');
const fsUtils = require("nodejs-fs-utils");
const Errors = require('./errors');

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

    setNoCache(value)
    {
        this._noCache = value;
    }

    setTmpDir(value)
    {
        this._tmpDirOverride = value;
    }

    perform()
    {
        return Promise.resolve()
            .then(() => this._storeDefinitions())
            .then(() => this._processDockerBased())
            .then(() => this._processLambdaBased())
            .then(() => this._processDatabases())
            .then(() => this._screen.info('Build completed.'))
            ;
    }

    _storeDefinitions()
    {
        return Promise.resolve()
            .then(() => Promise.serial(this._registry.clusters, x => this._storeClusterDefinition(x)))
    }

    _storeClusterDefinition(cluster)
    {
        var clusterDefinitions = cluster.extractDefinitions();
        var policyDefinitions = this._registry.extractPolicies();
        var definitions = _.concat(clusterDefinitions, policyDefinitions)

        var clusterSpec = {
            name: cluster.name,
            isImplicit: false,
            definitions: definitions
        }
        
        this._config.set('clusters', [cluster.name], clusterSpec);
    }

    _processDockerBased()
    {
        return Promise.resolve()
            .then(() => Promise.serial(this._registry.image_based, image => this._loadDockerFile(image)))
            .then(() => {
                var resolver = new DependencyResolver();
                var myImages = {};
                for (var item of this._registry.image_based) {
                    var imageName = this._getItemImageName(item);
                    myImages[imageName] = item;
                    resolver.add(imageName, item.baseImage);
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

    _getItemImageName(item)
    {
        var imageNaming = [item.clusterName];
        if (item.sectorName) {
            imageNaming.push(item.sectorName);
        }
        imageNaming.push(item.name);
        var imageName = imageNaming.join('-');
        return imageName;
    }

    _buildDockerImage(item)
    {
        if (!item.hasDockerfile) {
            this._logger.warn('[_buildDockerImage] Missing dockerfile for %s.', item.id);
            return;
        }
        var watch = this._screen.stopwatch();
        this._screen.info('Building docker image %s...', item.id);

        this._logger.info('[_buildDockerImage] Building docker image for %s....', item.id);
        this._logger.info('[_buildDockerImage] Item Class: %s...', item.constructor.name);
        this._logger.info('[_buildDockerImage] Build Path: %s', item.path);

        var targetBuildPath = null;
        var dockerfile = null;
        var imageName = this._getItemImageName(item);

        this._logger.info('[_buildDockerImage] Image Name: %s', imageName);

        return Promise.resolve()
            .then(() => this._getBuildTargetPath(item))
            .then(result => {
                targetBuildPath = result;
                dockerfile = Path.join(targetBuildPath, 'Dockerfile');

                this._logger.info('[_buildDockerImage] Build Path: %s', targetBuildPath);
                this._logger.info('[_buildDockerImage] DockerFile: %s', dockerfile);

                var buildCommands = ['build'];
                if (this._noCache) {
                    buildCommands.push('--no-cache')
                }
                buildCommands.push('-t')
                buildCommands.push(imageName)
                buildCommands.push(targetBuildPath)

                return this._docker.command(buildCommands.join(' '))
            })
            .then(result => {
                if (result.code != 0) {
                    throw new Error ('Could not build docker image for ' + imageName + '. Path: ' + dockerfile);
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
                this._screen.info('Build of %s completed. %s.', item.id, watch.finish());
            })
            .catch(reason => {
                this._logger.error('Failed to build %s image...', item.id);
                this._screen.error('Failed to build %s image. %s.', item.id, watch.finish());
                throw new Errors.Generic("Failed to build " + item.id + " image");
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
            var newBuildPath = tmp.dirSync({dir: this._getRootTmpDir()});
            var targetBuildPath = newBuildPath.name;
            this._screen.info('Copying %s to %s...', item.path, targetBuildPath);
            var options = {
                symbolicLinks: false,
                filter: [
                    ".*(?<!node_modules\\/\\.bin)$",
                ]
            }
            return JobRunner.copy(item.path, targetBuildPath, options)
                .then(() => {
                    this._screen.info('Copy %s to %s done.', item.path, targetBuildPath);
                    if (!fs.existsSync(targetBuildPath)) {
                        this._screen.info('Failed to copy %s to %s. Destination did not get created.', item.path, targetBuildPath);
                        throw new Error('Path ' + targetBuildPath + ' does not exist');
                    }
                })
                .then(() => {
                    return Promise.promisify(fsUtils.fsize)(targetBuildPath)
                        .then(size => {
                            this._screen.info('Destination %s size is %s', targetBuildPath, size);
                            if (size == "40") {
                                throw new Error("Folder size is not valid.");
                            }
                        })
                })
                .then(() => targetBuildPath);
        } else {
            return item.path;
        }
    }

    _processLambdaBased()
    {
        return Promise.resolve()
            .then(() => this._registry.lambdas.filter(x => this._shouldBuildLambda(x)))
            .then(lambdas => Promise.parallel(lambdas, x => this._buildLambda(x)));
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

    _getEntityDir(entity)
    {
        var pathParts = [entity.kind, entity.naming.join('-')];
        var outputDir = this._getTmpDir(pathParts);
        return outputDir;
    }

    _buildLambda(lambda)
    {
        this._screen.info('Building %s...', lambda.id);
        const watch = this._screen.stopwatch();

        this._logger.info('[_buildLambda] Building lambda image for %s....', lambda.id);
        this._logger.info('[_buildLambda] Lambda Path: %s', lambda.path);

        // var pathParts = _.concat()
        // var outputDir = this._getTmpDir([lambda.clusterName, lambda.sectorName, 'lambda', lambda.name]);
        var outputDir = this._getEntityDir(lambda);
        this._logger.info('[_buildLambda] Output dir: %s', outputDir);

        var outputFilePath = Path.join(outputDir, 'code.zip')
        var origCodeDir = Path.join(lambda.path, lambda.codePath);
        this._logger.info('[_buildLambda] Code Path: %s', origCodeDir);


        return Promise.resolve()
            .then(() => this._execLambdaPreBuild(lambda, origCodeDir))
            .then(() => this._getBuildTargetPath(lambda))
            .then(rootDir => {
                return this._execLambdaMidBuild(lambda, rootDir)
                    .then(() => rootDir);
            })
            .then(rootDir => {
                var codeDir = Path.join(rootDir, lambda.codePath);
                this._screen.info('Compressing %s to %s...', codeDir, outputFilePath)
                var compressWatch = this._screen.stopwatch();
                return JobRunner.compressDirectoryToFile(codeDir, outputFilePath)
                    .then(() => {
                        this._screen.info('Compression of %s completed. %s.', outputFilePath, compressWatch.finish());
                    })
            })
            .then(() => {
                return JobRunner.calculateSha256FromFile(outputFilePath)
            })
            .then(result => {
                var checksum = 'sha256:' + result;
                this._screen.info('    Lambda %s checksum = %s', lambda.id, checksum)
                this._screen.info('Build of %s completed. %s.', lambda.id, watch.finish());
                this._config.set('repository', [lambda.naming[0], lambda.id], { kind: 'lambda', path: outputFilePath, digest: checksum});
            })
            .catch(reason => {
                this._logger.error('Failed to build %s image...', lambda.id);
                this._screen.error('Failed to build %s image. %s.', lambda.id, watch.finish());
                console.log(reason);
                this._logger.error(reason);
                throw new Errors.Generic("Failed to build " + lambda.id + " image");
            })
            ;
    }

    _execLambdaPreBuild(lambda, codeDir)
    {
        var preBuildCommands = _.clone(lambda.preBuildCommands);
        if (_.startsWith(lambda.runtime, 'nodejs')) {
            preBuildCommands.push('npm install --production')
        }
        return Promise.serial(preBuildCommands, x => this._shell.runShell(x, codeDir));
    }

    _execLambdaMidBuild(lambda, codeDir)
    {
        var midBuildCommands = _.clone(lambda.midBuildCommands);
        return Promise.serial(midBuildCommands, x => this._shell.runShell(x, codeDir));
    }

    _processDatabases()
    {
        var databases = this._registry.databases;
        databases = databases.filter(x => x.className == 'sql');
        databases = databases.filter(x => x.hasInitScript);

        return Promise.serial(databases, x => this._buildDatabase(x));
    }

    _buildDatabase(database)
    {
        this._screen.info('Building Database %s...', database.id);

        this._logger.info('[_buildDatabase] Building database for %s....', database.id);

        var initPath = Path.join(database.path, database.definition.init);
        this._logger.info('[_buildDatabase] Init Path: %s', initPath);

        if (!fs.existsSync(initPath)) {
            throw new Errors.Generic(`Database init file not found for ${database.id}. Path=${initPath}`);
        }

        var outputDir = this._getEntityDir(database);
        this._logger.info('[_buildDatabase] Output dir: %s', outputDir);

        var outputFilePath = Path.join(outputDir, 'init.sql');
        return Promise.resolve()
            .then(() => {
                return fsCopy(initPath, outputFilePath);
            })
            .then(() => {
                return JobRunner.calculateSha256FromFile(outputFilePath)
            })
            .then(result => {
                var checksum = 'sha256:' + result;
                this._screen.info('    Database %s checksum = %s', database.id, checksum)
                this._config.set('repository', [database.naming[0], database.id], { kind: 'database', path: outputDir, digest: checksum});
            })
            .catch(reason => {
                this._logger.error('Failed to build %s...', database.id);
                this._screen.error('Failed to build %s...', database.id);
                console.log(reason);
                this._logger.error(reason);
                throw new Errors.Generic(`Failed to build ${database.id} image`);
            })
            ;
    }

    _getTmpDir(components) {
        var parts = _.flattenDeep([this._getRootTmpDir(), components])
        var fullPath = Path.join.apply(null, parts);
        this._shell.shell.mkdir('-p', fullPath);
        return fullPath;
    }

    _getRootTmpDir()
    {
        if (this._rootTmpDir) {
            return this._rootTmpDir;
        }

        if (this._tmpDirOverride) {
            if (this._shell.shell.test('-d', this._tmpDirOverride)) {
                this._screen.info('Emptying tmp directory %s...', this._tmpDirOverride);
                this._shell.shell.rm('-rf', Path.join(this._tmpDirOverride, "*") );
            } else {
                this._shell.shell.mkdir('-p', this._tmpDirOverride);
            }
            this._rootTmpDir = this._tmpDirOverride;
        } else {
            var x = tmp.dirSync();
            this._rootTmpDir = x.name;
        }

        return this._rootTmpDir;
    }
}

module.exports = Builder;
