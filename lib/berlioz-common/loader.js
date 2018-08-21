const Extractor = require('./extractor');
const Registry = require('./registry');
const Parser = require('./parser');
const Path = require('path');
const Promise = require('the-promise');


class Loader
{
    constructor(logger)
    {
        this._logger = logger;
        require('./logger').logger = logger;
        this._parser = new Parser(logger);
    }

    fromDir(rootDir)
    {
        return this.fromDirs(rootDir, ['.']);
    }

    fromDirs(rootDir, relativePaths)
    {
        var registry = new Registry();
        var dirs = relativePaths.map(x => Path.resolve(rootDir, x));
        return Promise.serial(dirs, x => this._processFromDir(registry, x))
            .then(() => {
                return this.postProcess(registry);
            });
    }

    _processFromDir(registry, dir)
    {
        var extractor = new Extractor(this._logger, dir);
        return extractor.perform(path => {
            var obj = this._parser.parse(path);
            if (obj) {
                obj.addToRegistry(registry);
            } else {
                console.log('Failed to parse: ' + path)
            }
        });
    }

    fromDefinitions(definitions)
    {
        var registry = new Registry();
        for(var definition of definitions)
        {
            var obj = this._parser.parseDefinition(definition);
            if (obj) {
                obj.addToRegistry(registry);
            }
        }
        return this.postProcess(registry);
    }

    postProcess(registry)
    {
        for(var x of registry.image_based) {
            var cluster = registry.getCluster(x.definition.cluster);
            if (!cluster) {
                cluster = this._parser.parseDefinition({ kind: 'cluster', name: x.definition.cluster });
                cluster.addToRegistry(registry);
            }
        }

        for(var image of registry.images) {
            var cluster = registry.getCluster(image.clusterName);
            if (cluster) {
                cluster.acceptItem(image);
            }
        }

        for(var service of registry.services) {
            var cluster = registry.getCluster(service.clusterName);
            if (cluster) {
                cluster.acceptItem(service);
            }
        }

        for(var database of registry.databases) {
            var cluster = registry.getCluster(database.clusterName);
            if (cluster) {
                cluster.acceptItem(database);
            }
        }

        for(var queue of registry.queues) {
            var cluster = registry.getCluster(queue.clusterName);
            if (cluster) {
                cluster.acceptItem(queue);
            }
        }

        for(var secret of registry.secrets) {
            var cluster = registry.getCluster(secret.clusterName);
            if (cluster) {
                cluster.acceptItem(secret);
            }
        }

        for(var lambda of registry.lambdas) {
            var cluster = registry.getCluster(lambda.clusterName);
            if (cluster) {
                cluster.acceptItem(lambda);
            }
        }

        for(var cluster of registry.clusters) {
            cluster.postLoad();
        }

        return registry;
    }
}

module.exports = Loader;
