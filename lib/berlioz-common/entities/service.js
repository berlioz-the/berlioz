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
        this._massageStorageConfig();
    }

    get provides() {
        return this._provides;
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
       return this.cluster._buildExecutablePolicy(this);
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

    getScaling()
    {
        var policy = this.resolvePolicy('scale');
        var result = {
            isAutoscaled: false,
            min: 1,
            max: 1,
            desired: 1
        }

        if (_.isNotNullOrUndefined(policy)) {
            if (policy.metrics) {
                result.metrics = policy.metrics;
            } else {
                result.metrics = {};
            }

            if (_.isNotNullOrUndefined(policy.min)) {
                result.min = policy.min;
            } else {
                result.min = 1;
            }

            if (_.isNotNullOrUndefined(policy.max)) {
                result.max = policy.max;
            } else {
                result.max = result.min;
            }

            if (_.isNotNullOrUndefined(policy.desired)) {
                result.desired = policy.desired;
            } else {
                result.desired = result.min;
            }

            if (_.keys(result.metrics).length > 0)
            {
                result.isAutoscaled = true;
            }
        }

        if (result.max < result.min) {
            result.max = result.min;
        }
        if (result.max < result.desired) {
            result.max = result.desired;
        }

        if (this.definition.scale) {
            if (_.isNumber(this.definition.scale.min)) {
                if (result.desired < this.definition.scale.min) {
                    result.desired = this.definition.scale.min;
                }
            }
        }

        return result;
    }

    // #region Validation
    _getValidationSchema(Joi)
    {
        return Joi.object().keys({
            kind: Joi.string().required(),
            cluster: Joi.clusterName().required(),
            sector: Joi.sectorName(),
            name: Joi.serviceName().required(),
            identity: Joi.object().keys({
                kind: Joi.string(),
            }),
            code: Joi.object().keys({
                kind: Joi.string().required(),
                image: Joi.string(),
                extendSymlinks: Joi.boolean()
            }),
            storage: Joi.array().items(Joi.object().keys({
                    kind: Joi.string().valid('volume'),
                    path: Joi.string().required(),
                    size: Joi.string().required(),
                    permanent: Joi.boolean()
                })
            ),
            provides: Joi.object().pattern(Joi.endpointNameRegex(), Joi.object().keys({
                port: Joi.number().integer().required(),
                protocol: Joi.string().valid('http', 'https', 'ws', 'tcp', 'udp').required(),
                'load-balance': Joi.boolean(),
                dns: Joi.boolean(),
                reserved: Joi.boolean()
            })),
            consumes: Joi.array().items(Joi.object().keys({
                    service: Joi.serviceName(),
                    secret: Joi.string(), // todo: work on this.
                    action: Joi.string(), // todo: work on this.
                    endpoint: Joi.endpointName(),
                    database: Joi.databaseName(),
                    queue: Joi.queueName(),
                    cluster: Joi.clusterName(),
                    sector: Joi.sectorName(),
                    actions: Joi.array()
                })
                .without('cluster', 'service')
                .without('cluster', 'database')
                .without('cluster', 'queue')
                .without('cluster', 'sector')
                .without('database', 'queue')
                .without('database', 'endpoint')
                .without('queue', 'endpoint')
            ),
            environment: Joi.environmentMap(),
            resources: Joi.object().keys({
                memory: Joi.object().keys({
                    min: Joi.number().integer(),
                    max: Joi.number().integer()
                })
            }),
            checks: Joi.array().items(Joi.object().keys({
                    stage: Joi.string().valid('health', 'ready').required(),
                    command: Joi.alternatives(
                        Joi.string(),
                        Joi.array().items(Joi.string())
                    ),
                    endpoint: Joi.endpointName(),
                    path: Joi.string(),
                    httpHeaders: Joi.object(),
                    timing: Joi.object(),
                    thresholds: Joi.object()
                })
                .without('command', 'endpoint')
                .without('command', 'path')
                .without('command', 'httpHeaders')
            ),
        });
    }
    // #endregion

}


module.exports = Service;
