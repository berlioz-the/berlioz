const Base = require('./base');
const DockerBased = require('./docker-based');
const ServiceProvided = require('./service-provided');

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
        return this._getConsumes('endpoint');
    }

    get localConsumes() {
        return this._getConsumes('local-endpoint');
    }

    get remoteConsumes() {
        return this._getConsumes('remote-endpoint');
    }

    get databasesConsumes() {
        return this._getConsumes('database');
    }

    get queuesConsumes() {
        return this._getConsumes('queue');
    }

    get secretsConsumes() {
        return this._getConsumes('secret');
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
        this._loadConsumesConfig(this.definition.consumes)
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
        for(var x of _.values(this._provides)) {
            x.addToRegistry(registry);
        }
    }
}


module.exports = Service;
