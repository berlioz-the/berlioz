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

    addToCluster(registry, item, clusterName)
    {
        var cluster = registry.getCluster(clusterName);
        if (!cluster) {
            cluster = this._parser.parseDefinition({ kind: 'cluster', name: clusterName });
            cluster.addToRegistry(registry);
        }
        cluster.acceptItem(item);
    }

    postProcess(registry)
    {
        for(var image of registry.images) {
            this.addToCluster(registry, image, image.clusterName);
        }

        for(var service of registry.services) {
            this.addToCluster(registry, service, service.clusterName);
        }

        for(var database of registry.databases) {
            this.addToCluster(registry, database, database.clusterName);
        }

        for(var queue of registry.queues) {
            this.addToCluster(registry, queue, queue.clusterName);
        }

        for(var secret of registry.secrets) {
            this.addToCluster(registry, secret, secret.clusterName);
        }

        for(var lambda of registry.lambdas) {
            this.addToCluster(registry, lambda, lambda.clusterName);
        }

        for(var trigger of registry.triggers) {
            this.addToCluster(registry, trigger, trigger.clusterName);
        }

        for(var cluster of registry.clusters) {
            cluster.postLoad();
        }

        registry.initPolicyResolver();

        return registry;
    }
}

module.exports = Loader;
