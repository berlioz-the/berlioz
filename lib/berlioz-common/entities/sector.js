const Base = require('./base');
const _ = require('the-lodash');

class Sector extends Base
{
    constructor(definition)
    {
        super(definition, [definition.cluster, definition.name]);
        this._isImplicit = true;
    }

    get clusterName() {
        return this.definition.cluster;
    }

    get cluster() {
        return this.registry.findByNaming('cluster', this.clusterName);
    }

    get name() {
        return this.definition.name;
    }

    get services() {
        return this.getLinks('service');
    }

    get images() {
        return this.getLinks('image');
    }

    get databases() {
        return this.getLinks('database');
    }

    get queues() {
        return this.getLinks('queue');
    }

    get secrets() {
        return this.getLinks('secret');
    }

    get lambdas() {
        return this.getLinks('lambda');
    }

    get triggers() {
        return this.getLinks('trigger');
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
    }

    _getPolicyTarget()
    {
        return {
            cluster: this.clusterName,
            sector: this.name
        };
    }
}

module.exports = Sector;
