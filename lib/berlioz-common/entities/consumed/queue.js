const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedQueue extends ConsumedBase
{
    constructor(definition, source)
    {
        definition.kind = 'queue-consumed';
        var targetNaming = [source.clusterName, definition.sector, definition.name];
        var naming = _.concat(source.naming, targetNaming);

        super(definition, naming, source, 'queue', targetNaming);
    }

}

module.exports = ConsumedQueue;
