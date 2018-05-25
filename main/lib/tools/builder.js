const _ = require('the-lodash');
const spawn = require('cross-spawn');
const Promise = require('the-promise');
const tmp = require('tmp');
const Path = require('path');
const fs = require('fs');
const copy = require('recursive-copy');
const DependencyResolver = require('processing-tools/dependency-resolver');

class Builder
{
    constructor(logger, registry)
    {
        this._logger = logger;
        this._registry = registry;
    }

    perform()
    {
        return Promise.resolve()
            .then(() => Promise.serial(this._registry.image_based(), image => this._loadDockerFile(image)))
            .then(() => {
                var resolver = new DependencyResolver();
                var myImages = {};
                for (var def of this._registry.image_based()) {
                    myImages[def.image] = def;
                    resolver.add(def.image, def.baseImage);
                }

                var imagesToBuild = resolver.order.map(x => myImages[x]).filter(x => x);
                return Promise.serial(imagesToBuild, x => this._buildDockerImage(x));
            });
    }

    _buildDockerImage(def)
    {
        if (!def.hasDockerfile) {
            this._logger.warn('Missing dockerfile for %s.', def.id);
            return;
        }
        this._logger.info('Building docker image for %s....', def.id);

        this._logger.info('[_buildDockerImage] class: %s...', def.constructor.name);
        this._logger.info('Build path: %s', def.path);
        this._logger.info('Image: %s', def.image);

        var targetBuildPath = null;

        return Promise.resolve()
            .then(() => {
                if (true) {
                    var newBuildPath = tmp.dirSync();
                    targetBuildPath = newBuildPath.name;
                    this._logger.info('TMP BUILD PATH: %s', targetBuildPath);
                    return copy(def.path, targetBuildPath, {
                        expand: true
                    });
                } else {
                    targetBuildPath = def.path;
                }
            })
            .then(() => {
                return spawn.sync('ls', ['-la', targetBuildPath ], { stdio: 'inherit', shell: true });
            })
            .then(() => {
                var dockerfile = Path.join(targetBuildPath, 'Dockerfile');

                this._logger.info('NEW BUILD PATH: %s', targetBuildPath);
                this._logger.info('NEW DockerFile: %s', dockerfile);

                var result = spawn.sync('docker', ['build', '-t', def.image, targetBuildPath], { stdio: 'inherit' });
                // this._logger.info(result);
                this._logger.info('EXIT CODE: %s', result.status);
                if (result.status != 0) {
                    throw new Error ('Could not build docker image for ' + def.image + '. Path: ' + dockerfile);
                }

                this._logger.info('IMAGE BUILD COMPLETED');
            });
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

}

module.exports = Builder;
