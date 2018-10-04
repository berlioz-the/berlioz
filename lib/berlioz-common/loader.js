const Extractor = require('./extractor');
const Parser = require('./parser');
const Path = require('path');
const Promise = require('the-promise');
const _ = require('the-lodash');


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
        const Registry = require('./registry');
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
            var parsedObjects = this._parser.parse(path);
            if (parsedObjects) {
                for(var obj of parsedObjects) {
                    obj.addToRegistry(registry);
                }
            }
            else 
            {
                console.log('Failed to parse: ' + path)
            }
        });
    }

    parseDefinition(definition)
    {
        return this._parser.parseDefinition(definition);
    }

    fromDefinitions(definitions)
    {
        definitions = _.cloneDeep(definitions);
        const Registry = require('./registry');
        var registry = new Registry();
        for(var definition of definitions)
        {
            var obj = this.parseDefinition(definition);
            if (obj) {
                obj.addToRegistry(registry);
            }
        }
        return this.postProcess(registry);
    }

    postProcess(registry)
    {
        var clusterNames = {};
        for(var x of registry.image_based) {
            clusterNames[x.definition.cluster] = true;
        }
        for(var lambda of registry.lambdas) {
            clusterNames[lambda.clusterName] = true;
        }
        for (var clusterName of _.keys(clusterNames)) {
            var cluster = registry.getCluster(clusterName);
            if (!cluster) {
                cluster = this.parseDefinition({ kind: 'cluster', name: clusterName });
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

        registry.initPolicyResolver();

        return registry;
    }
}

module.exports = Loader;
