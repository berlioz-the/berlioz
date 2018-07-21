const Base = require('./base');
const _ = require('the-lodash');
const ClusterProvided = require('./cluster-provided');

class Cluster extends Base
{
    constructor(definition)
    {
        super(definition, definition.name);
        this._services = {};
        this._images = {};
        this._databases = {};
        this._queues = {};
        this._secrets = {};
        this._lambdas = {};
        this._massageProvidesConfig();
    }

    get name() {
        return this.definition.name;
    }

    get services() {
        return _.values(this._services);
    }

    get images() {
        return _.values(this._images);
    }

    get databases() {
        return _.values(this._databases);
    }

    get queues() {
        return _.values(this._queues);
    }

    get secrets() {
        return _.values(this._secrets);
    }

    get lambdas() {
        return _.values(this._lambdas);
    }

    get provides() {
        return this._provides;
    }

    get environment() {
        if (this.definition.environment) {
            return this.definition.environment;
        }
        return {};
    }

    addService(service)
    {
        this._services[service.id] = service;
    }

    addImage(image)
    {
        this._images[image.id] = image;
    }

    addDatabase(database)
    {
        this._databases[database.id] = database;
    }

    addQueue(queue)
    {
        this._queues[queue.id] = queue;
    }

    addSecret(secret)
    {
        this._secrets[secret.id] = secret;
    }

    addLambda(lambda)
    {
        this._lambdas[lambda.id] = lambda;
    }

    getImageByName(name)
    {
        for(var image of this.iamges) {
            if (image.definition.name == name) {
                return image;
            }
        }
        return null;
    }

    getServiceByName(name)
    {
        for(var service of this.services) {
            if (service.definition.name == name) {
                return service;
            }
        }
        return null;
    }

    getServiceByFullName(name)
    {
        for(var service of this.services) {
            var full_name = service.clusterName + '-' + service.name;
            if (full_name == name) {
                return service;
            }
        }
        return null;
    }

    _massageProvidesConfig()
    {
        this._provides = {};

        if (!this.definition.provides) {
            return;
        }

        for (var providedName of _.keys(this.definition.provides))
        {
            var configProvided = this.definition.provides[providedName];

            var provided = new ClusterProvided({
                name: providedName,
                serviceName: configProvided.service,
                endpointName: configProvided.endpoint,
                public: Base.parseBool(configProvided.public),
            }, this);
            this._provides[providedName] = provided;
        }
    }

    postLoad()
    {
        for(var provided of _.values(this.provides))
        {
            provided.postLoad();
        }
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
        data.push(['image count', this.images.length.toString()]);
        data.push(['service count', this.services.length.toString()]);
    }

    extractDefinitions()
    {
        var definitions = [];
        definitions.push(this.definition);
        for(var service of this.services)
        {
            definitions.push(service.definition);
        }
        for(var db of this.databases)
        {
            definitions.push(db.definition);
        }
        for(var queue of this.queues)
        {
            definitions.push(queue.definition);
        }
        for(var secret of this.secrets)
        {
            definitions.push(secret.definition);
        }
        for(var lambda of this.lambdas)
        {
            definitions.push(lambda.definition);
        }
        return definitions;
    }

    _handleAddToRegistry(registry)
    {
        for(var x of _.values(this.provides)) {
            x.addToRegistry(registry);
        }
    }

}


module.exports = Cluster;
