const Base = require('./base');
const _ = require('the-lodash');

class Lambda extends Base
{
    constructor(definition)
    {
        Base.setupSector(definition)
        super(definition, [definition.cluster, definition.sector, definition.name]);
        this._massageConsumesConfig()
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

    get triggerConsumes() {
        return this.getLinks('trigger-consumed');
    }

    get lambdaConsumes() {
        return this.getLinks('lambda-consumed');
    }
    
    get metaConsumes() {
        return this.getLinks('meta-consumed');
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

    _massageConsumesConfig()
    {
        this._loadConsumesConfig(this.definition.consumes)
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
       return this.cluster._buildExecutablePolicy(this);
    }
}


module.exports = Lambda;
