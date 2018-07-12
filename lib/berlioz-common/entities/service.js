const Base = require('./base');
const DockerBased = require('./docker-based');
const ServiceProvided = require('./service-provided');
const ServiceEndpointConsumed = require('./service-endpoint-consumed');
const ServiceDatabaseConsumed = require('./service-database-consumed');
const ServiceQueueConsumed = require('./service-queue-consumed');
const ServiceSecretConsumed = require('./service-secret-consumed');

const _ = require('the-lodash');

class Service extends DockerBased
{
    constructor(definition)
    {
        super(definition);
        this._massageProvidesConfig();
        this._massageConsumesConfig();
        this._massageStorageConfig();
    }

    get cluster() {
        return this.registry.findByNaming('cluster', this.clusterName);
    }

    get provides() {
        return this._provides;
    }

    get consumes() {
        return this._endpointsConsumes;
    }

    get localConsumes() {
        return this._localEndpointsConsumes;
    }

    get remoteConsumes() {
        return this._remoteEndpointsConsumes;
    }

    get databasesConsumes() {
        return this._databasesConsumes;
    }

    get queuesConsumes() {
        return this._queuesConsumes;
    }

    get secretsConsumes() {
        return this._secretsConsumes;
    }

    get storage() {
        return this._storage;
    }

    get identity() {
        if (this.definition.identity) {
            if (this.definition.identity.kind) {
                return this.definition.identity.kind;
            }
        }
        return 'none';
    }

    get serviceEnvironment() {
        if (this.definition.environment) {
            return this.definition.environment;
        }
        return {};
    }

    get clusterEnvironment() {
        var cluster = this.cluster;
        if (!cluster) {
            return {};
        }
        return cluster.environment;
    }

    get environment() {
        return _.defaults(_.clone(this.serviceEnvironment), this.clusterEnvironment);
    }

    extractData(data)
    {
        super.extractData(data);
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
            var networkProtocol;
            if (configProvided.protocol == 'udp') {
                networkProtocol = 'udp';
            } else {
                networkProtocol = 'tcp';
            }

            var provided = new ServiceProvided({
                name: providedName,
                port: configProvided.port,
                protocol: configProvided.protocol,
                networkProtocol: networkProtocol,
                reserved: Base.parseBool(configProvided.reserved),
                loadBalance: Base.parseBool(configProvided['load-balance']),
                dns: Base.parseBool(configProvided['dns']),
                multipleSubdomains: Base.parseBool(configProvided['multiple-subdomains'])
            }, this);
            this._provides[providedName] = provided;
        }
    }

    _massageConsumesConfig()
    {
        this._endpointsConsumes = [];
        this._localEndpointsConsumes = [];
        this._remoteEndpointsConsumes = [];
        this._databasesConsumes = [];
        this._queuesConsumes = [];
        this._secretsConsumes = [];

        if (!this.definition.consumes) {
            return;
        }

        for(var consumer of this.definition.consumes)
        {
            if (consumer.cluster || consumer.service) {
                var def = {
                    endpoint: consumer.endpoint
                };
                if (consumer.cluster) {
                    def.cluster = consumer.cluster;
                } else {
                    def.service = consumer.service;
                }
                var serviceConsumed = new ServiceEndpointConsumed(def, this);
                this._endpointsConsumes.push(serviceConsumed);
                if(serviceConsumed.targetKind == 'service') {
                    this._localEndpointsConsumes.push(serviceConsumed);
                } else {
                    this._remoteEndpointsConsumes.push(serviceConsumed);
                }
            } else if (consumer.database) {
                var def = {
                    name: consumer.database
                };
                var dbConsumed = new ServiceDatabaseConsumed(def, this);
                this._databasesConsumes.push(dbConsumed);
            } else if (consumer.queue) {
                var def = {
                    name: consumer.queue
                };
                var queueConsumed = new ServiceQueueConsumed(def, this);
                this._queuesConsumes.push(queueConsumed);
            } else if (consumer.secret) {
                var def = {
                    name: consumer.secret,
                    actions: []
                };
                if (_.isString(consumer.action)) {
                    def.actions.push(consumer.action)
                } else if (_.isArray(consumer.action)) {
                    for (var x of consumer.action) {
                        def.actions.push(x)
                    }
                }
                var secretConsumed = new ServiceSecretConsumed(def, this);
                this._secretsConsumes.push(secretConsumed);
            }
        }
    }

    _massageStorageConfig()
    {
        this._storage = [];

        if (!this.definition.storage) {
            return;
        }

        for(var x of this.definition.storage)
        {
            this._storage.push(x);
        }
    }

    _handleAddToRegistry(registry)
    {
        for(var x of this._endpointsConsumes) {
            x.addToRegistry(registry);
        }
        for(var x of this._databasesConsumes) {
            x.addToRegistry(registry);
        }
        for(var x of this._queuesConsumes) {
            x.addToRegistry(registry);
        }
        for(var x of this._secretsConsumes) {
            x.addToRegistry(registry);
        }
        for(var x of _.values(this._provides)) {
            x.addToRegistry(registry);
        }
    }
}


module.exports = Service;
