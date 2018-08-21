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
        this.registry.findByNaming('cluster', this.clusterName);
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
        return this.definition.resources.memory.min;
    }

    get timeout() {
        return this.definition.timeout;
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
    }

    _massageConsumesConfig()
    {
        this._loadConsumesConfig(this.definition.consumes)
    }

}


module.exports = Lambda;
