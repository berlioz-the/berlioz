const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedQueue extends ConsumedBase
{
    constructor(definition, source)
    {
        definition.kind = 'queue-consumed';
        var naming = [source.clusterName, source.name, definition.name];
        var targetNaming = [source.clusterName, definition.name];
        super(definition, naming, source, 'queue', targetNaming);
    }

}

module.exports = ConsumedQueue;
