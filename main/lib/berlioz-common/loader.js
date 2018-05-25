const Extractor = require('./extractor');
const Registry = require('./registry');
const Parser = require('./parser');

class Loader
{
    constructor(logger)
    {
        this._logger = logger;
        this._parser = new Parser(logger);
        this._registry = new Registry();
    }

    fromDir(rootDir)
    {
        var extractor = new Extractor(this._logger, rootDir);
        return extractor.perform(path => {
                var obj = this._parser.parse(path);
                if (obj) {
                    obj.addToRegistry(this._registry);
                }
            })
            .then(() => {
                return this._postProcess(this._registry);
            });
    }

    fromDefinitions(definitions)
    {
        for(var definition of definitions)
        {
            var obj = this._parser.parseDefinition(definition);
            if (obj) {
                obj.addToRegistry(this._registry);
            }
        }
        return this._postProcess(this._registry);
    }

    _postProcess(registry)
    {
        for(var x of registry.image_based()) {
            var cluster = registry.getCluster(x.definition.cluster);
            if (!cluster) {
                cluster = this._parser.parseDefinition({ kind: 'cluster', name: x.definition.cluster });
                registry.add(cluster);
            }
        }

        for(var image of registry.images()) {
            var cluster = registry.getCluster(image.clusterName);
            cluster.addImage(image);
        }

        for(var service of registry.services()) {
            var cluster = registry.getCluster(service.clusterName);
            cluster.addService(service);
        }

        for(var database of registry.databases()) {
            var cluster = registry.getCluster(database.clusterName);
            cluster.addDatabase(database);
        }

        for(var queue of registry.queues) {
            var cluster = registry.getCluster(queue.clusterName);
            cluster.addQueue(queue);
        }

        for(var cluster of registry.clusters()) {
            cluster.postLoad();
        }

        return registry;
    }
}

module.exports = Loader;
