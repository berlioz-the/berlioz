const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedDatabase extends ConsumedBase
{
    constructor(definition, source)
    {
        definition.kind = 'database-consumed';
        var targetNaming = [source.clusterName, definition.sector, definition.name];
        var naming = _.concat(source.naming, targetNaming);
        super(definition, naming, source, 'database', targetNaming);
    }

}


module.exports = ConsumedDatabase;
