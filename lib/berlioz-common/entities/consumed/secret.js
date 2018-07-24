const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedSecret extends ConsumedBase
{
    constructor(definition, source)
    {
        definition.kind = 'secret-consumed';
        var naming = [source.clusterName, source.name, definition.name];
        var targetNaming = [source.clusterName, definition.name];
        super(definition, naming, source, 'secret', targetNaming);
    }

    get actions() {
        return this.definition.actions;
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['actions', this.actions]);
    }

}

module.exports = ConsumedSecret;
