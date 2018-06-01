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
    constructor(logger, registry, screen)
    {
        this._logger = logger;
        this._registry = registry;
        this._screen = screen;
    }

    perform()
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
                return Promise.serial(imagesToBuild, x => this._buildDockerImage(x));
            });
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
        return Promise.resolve()
            .then(() => this._getBuildTargetPath(item))
            .then(result => {
                targetBuildPath = result;
                dockerfile = Path.join(targetBuildPath, 'Dockerfile');

                this._logger.info('[_buildDockerImage] Build Path: %s', targetBuildPath);
                this._logger.info('[_buildDockerImage] DockerFile: %s', dockerfile);

                this._screen.info('Building docker image %s...', item.id);
                return this._exec('docker', ['build', '-t', item.image, targetBuildPath]);
            })
            .then(result => {
                if (result.status != 0) {
                    throw new Error ('Could not build docker image for ' + item.image + '. Path: ' + dockerfile);
                }
                this._logger.info('[_buildDockerImage] Image Build Completed');
            })
            ;
    }

    _exec(executable, args)
    {
        return new Promise((resolve, reject) => {
            this._screen.info('$ %s %s', executable, args.join(' '));
            var result = spawn.sync(executable, args, {
                stdio: 'inherit'
            });
            this._screen.info('Exit Code: %s', result.status);
            resolve(result);
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

}

module.exports = Builder;
