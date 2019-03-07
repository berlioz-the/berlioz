const _ = require('the-lodash');
const Base = require('./base');
const DockerBased = require('./docker-based');
const ServiceProvided = require('./service-provided');

class Service extends DockerBased
{
    constructor(definition)
    {
        super(definition);
        if (!this.definition.code) {
            this.definition.code = {}
        }
        if (!this.definition.code.kind) {
            this.definition.code.kind = 'docker';
        }
        this._massageProvidesConfig();
        this._massageConsumesConfig();
        this._massageStorageConfig();
    }

    get provides() {
        return this._provides;
    }

    get consumes() {
        return _.flatten([this.localConsumes, this.remoteConsumes])
    }

    get localConsumes() {
        return this.getLinks('local-endpoint');
    }

    get remoteConsumes() {
        return this.getLinks('remote-endpoint');
    }

    get databasesConsumes() {
        return this.getLinks('database-consumed');
    }

    get queuesConsumes() {
        return this.getLinks('queue-consumed');
    }

    get secretsConsumes() {
        return this.getLinks('secret-consumed');
    }

    get metaConsumes() {
        return this.getLinks('meta-consumed');
    }

    get triggerConsumes() {
        return this.getLinks('trigger-consumed');
    }

    get storage() {
        return this._storage;
    }

    get sidecar() {
        return this.definition.sidecar;
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
        return this._myEnvironment();
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

    get isManaged() {
        if ('unmanaged' in this.definition) {
            return !this.definition.unmanaged;
        }
        return true;
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
                path: configProvided.path,
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
            if (!x.kind) {
                x.kind = 'volume';
            }
            this._storage.push(x);
        }
    }

    _handleAddToRegistry(registry)
    {
        for(var x of _.values(this._provides)) {
            x.addToRegistry(registry);
        }
    }

    _getPolicyTarget()
    {
        return {
            cluster: this.clusterName,
            sector: this.sectorName,
            service: this.name
        };
    }

    buildMetadata()
    {
        var metadata = [];

        metadata.push({
            kind: 'service',
            id: this.id,
            cluster: this.clusterName,
            sector: this.sectorName,
            name: this.name
        });

        return metadata;
    }

    buildConsumedMeta()
    {
        var serviceConsumedMeta = [];

        for (var consumes of this.localConsumes)
        {
            serviceConsumedMeta.push({
                kind: 'service',
                id: consumes.targetId,
                cluster: consumes.targetNaming[0],
                sector: consumes.targetNaming[1],
                name: consumes.targetNaming[2],
                endpoint: consumes.targetEndpoint,
                isolation: consumes.isolation
            });
        }

        for (var consumes of this.remoteConsumes)
        {
            serviceConsumedMeta.push({
                kind: 'cluster',
                id: consumes.targetId,
                cluster: consumes.targetNaming[0],
                endpoint: consumes.targetEndpoint,
                isolation: consumes.isolation
            });
        }

        for (var consumes of this.databasesConsumes)
        {
            serviceConsumedMeta.push({
                kind: 'database',
                id: consumes.targetId,
                cluster: consumes.targetNaming[0],
                sector: consumes.targetNaming[1],
                name: consumes.targetNaming[2],
                endpoint: consumes.targetEndpoint
            });
        }

        for (var consumes of this.queuesConsumes)
        {
            serviceConsumedMeta.push({
                kind: 'queue',
                id: consumes.targetId,
                cluster: consumes.targetNaming[0],
                sector: consumes.targetNaming[1],
                name: consumes.targetNaming[2],
                endpoint: consumes.targetEndpoint
            });
        }

        // TODO: check me. see metada-processor
        // for (var consumed of this.metaConsumes)
        // {
        //     var targetSector = consumed.localTarget;
        //     for (var consumedService of targetSector.services)
        //     {
        //         serviceConsumedMeta.push({
        //             kind: 'service',
        //             meta: true,
        //             id: consumedService.id,
        //             cluster: consumedService.naming[0],
        //             sector: consumedService.naming[1],
        //             name: consumedService.naming[2]
        //         });
        //     }
        // }

        return serviceConsumedMeta;
    }

    buildTaskPolicy()
    {
        var policies = {};

        policies['enable-zipkin'] = false;

        var dtraceConfig = this.resolvePolicy("distributed-tracing-provider");
        if (dtraceConfig.value == 'zipkin' || dtraceConfig.value == 'jaeger')
        {
            policies['enable-zipkin'] = true;
            policies['zipkin-service-id'] = ['cluster://sprt', 'dtracerep'].join('-');
        }

        return {
            values: policies
        };
    }

    getCpuUsage()
    {
        var config = this.resolvePolicy("cpu");
        return config;
    }
    
    getMemoryUsage()
    {
        var config = this.resolvePolicy("memory");

        var memoryResource = this.getResource('memory');
        if (memoryResource.min) {
            if (config.min < memoryResource.min)
            {
                config.min = memoryResource.min;
            }
        }

        return config;
    }

    getResource(name) {
        if (!this.definition.resources)
            return {};
        return this.definition.resources[name];
    }
}


module.exports = Service;
