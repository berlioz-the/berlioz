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

    fromDir(rootDir, ignoredirs)
    {
        return this.fromDirs(rootDir, ['.'], ignoredirs);
    }

    fromDirs(rootDir, relativePaths, ignoredirs)
    {
        var registry = this.newRegistry();
        var dirs = relativePaths.map(x => Path.resolve(rootDir, x));
        return Promise.serial(dirs, x => this._processFromDir(registry, x, ignoredirs))
            .then(() => {
                return this.postProcess(registry);
            });
    }

    _processFromDir(registry, dir, ignoredirs)
    {
        var extractor = new Extractor(this._logger, dir, ignoredirs);
        return extractor.perform(
            path => {
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
            },
            (error, path) => {
                registry.validator.submitPathError(path, error.message);
            });
    }

    parseDefinition(definition)
    {
        return this._parser.parseDefinition(definition);
    }

    newRegistry()
    {
        const Registry = require('./registry');
        var registry = new Registry(this._logger);
        return registry;
    }

    fromDefinitions(definitions)
    {
        if (!definitions) {
            throw new Error("Definitions not provided");
        }
        definitions = _.cloneDeep(definitions);
        var registry = this.newRegistry();
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
            cluster = this.parseDefinition({ kind: 'cluster', name: clusterName });
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
