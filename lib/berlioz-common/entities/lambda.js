const Base = require('./base');
const _ = require('the-lodash');

class Lambda extends Base
{
    constructor(definition)
    {
        super(definition, [definition.cluster, definition.name]);
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

    extractData(data)
    {
        super.extractData(data);
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
