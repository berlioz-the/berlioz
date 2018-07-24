const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedDatabase extends ConsumedBase
{
    constructor(definition, source)
    {
        definition.kind = 'database-consumed';
        var naming = [source.clusterName, source.name, definition.name];
        var targetNaming = [source.clusterName, definition.name];

        super(definition, naming, source, 'database', targetNaming);
    }

}


module.exports = ConsumedDatabase;
