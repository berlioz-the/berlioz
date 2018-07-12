const Base = require('./base');
const _ = require('the-lodash');

class Secret extends Base
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

    get className() {
        return this.definition.class;
    }

    get subClassName() {
        return this.definition.subClass;
    }

    get length() {
        return this.definition.length;
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
        data.push(['class', this.className]);
        data.push(['subClass', this.subClassName]);
        data.push(['length', this.length]);
    }

}


module.exports = Secret;
