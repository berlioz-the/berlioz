const Base = require('./base');
const _ = require('the-lodash');

class Lambda extends Base
{
    constructor(definition)
    {
        Base.setupSector(definition)
        super(definition, [definition.cluster, definition.sector, definition.name]);
    }

    get name() {
        return this.definition.name;
    }

    get clusterName() {
        return this.definition.cluster;
    }

    get cluster() {
        return this.registry.findByNaming('cluster', this.clusterName);
    }

    get sectorName() {
        return this.definition.sector;
    }

    get sector() {
        this.registry.findByNaming('sector', [this.clusterName, this.sectorName]);
    }

    get runtime() {
        return this.definition.runtime;
    }

    get handler() {
        return this.definition.handler;
    }

    get memory() {
        return this.getMemoryUsage().min;
    }

    get timeout() {
        if (_.isNotNullOrUndefined(this.definition.timeout)) {
            return this.definition.timeout;
        }
        return 5;
    }

    get code() {
        if (!this.definition.code) {
            return {};
        }
        return this.definition.code;
    }

    get extendSymlinks() {
        if (this.code.extendSymlinks) {
            return true;
        }
        return false;
    }
    
    get codePath() {
        if (this.code.path) {
            return this.code.path 
        }
        return "src";
    }

    get exposed() {
        if (!this.definition.exposed) {
            return []
        }
        return this.definition.exposed;
    }

    get lambdaEnvironment() {
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
        return _.defaults(_.clone(this.lambdaEnvironment), this.clusterEnvironment);
    }

    get preBuildCommands() {
        var value = this.definition['pre-build']
        if (_.isString(value)) {
            return [value]
        }
        if (_.isArray(value)) {
            return value
        }
        return [];
    }

    get midBuildCommands() {
        var value = this.definition['mid-build']
        if (_.isString(value)) {
            return [value]
        }
        if (_.isArray(value)) {
            return value
        }
        return [];
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['clusterName', this.clusterName]);
        data.push(['sectorName', this.sectorName]);
        data.push(['name', this.name]);
        data.push(['runtime', this.runtime]);
        data.push(['handler', this.handler]);
        data.push(['memory', this.memory]);
        data.push(['timeout', this.timeout]);
        data.push(['codePath', this.codePath]);
        // data.push(['environment', JSON.stringify(this.environment)]);
    }

    _getPolicyTarget()
    {
        return {
            cluster: this.clusterName,
            sector: this.sectorName,
            lambda: this.name
        };
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

    buildTaskPolicy()
    {
        var policies = this.cluster._buildExecutablePolicy(this);
        policies.values['enable-zipkin'] = false;
        return policies;
    }

    // #region Validation
    _getValidationSchema(Joi)
    {
        return Joi.object().keys({
            kind: Joi.string().required(),
            cluster: Joi.clusterName().required(),
            sector: Joi.sectorName(),
            name: Joi.lambdaName().required(),

            runtime: Joi.string().required(),
            handler: Joi.string().required(),
            timeout: Joi.number().integer(),

            code: Joi.object().keys({
                path: Joi.string(),
                extendSymlinks: Joi.boolean()
            }),

            'mid-build': Joi.alternatives(
                Joi.string(),
                Joi.array().items(Joi.alternatives(
                    Joi.string(),
                    Joi.object().keys({
                        cmd: Joi.string(),
                        dir: Joi.string()
                    })
                ))
            ),

            consumes: Joi.array().items(Joi.object().keys({
                    database: Joi.databaseName(),
                    queue: Joi.queueName(),
                    lambda: Joi.lambdaName(),
                    trigger: Joi.triggerName(),
                    sector: Joi.sectorName(),
                    actions: Joi.array()
                })
                .without('database', 'queue')
                .without('database', 'trigger')
                .without('database', 'lambda')
                .without('queue', 'lambda')
                .without('queue', 'trigger')
                .without('lambda', 'trigger')

            ),

            exposed: Joi.array().items(Joi.object().keys({
                    api: Joi.string(),
                    path: Joi.string(),
                    method: Joi.string(),
                    authorize: Joi.object().keys({
                        lambda: Joi.lambdaName(),
                        database: Joi.databaseName()
                    })
                    .without('lambda', 'database')
                })
                .without('database', 'queue')
                .without('database', 'trigger')
                .without('queue', 'trigger')
            ),
            environment: Joi.environmentMap(),
            resources: Joi.object().keys({
                memory: Joi.object().keys({
                    min: Joi.number().integer()
                })
            })
        });
    }
    // #endregion
}


module.exports = Lambda;
