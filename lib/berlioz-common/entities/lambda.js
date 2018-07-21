const Base = require('./base');
const _ = require('the-lodash');

class Lambda extends Base
{
    constructor(definition)
    {
        super(definition, [definition.cluster, definition.name]);
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

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
        data.push(['runtime', this.runtime]);
        data.push(['handler', this.handler]);
        data.push(['memory', this.memory]);
    }

}


module.exports = Lambda;
