const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedTrigger extends ConsumedBase
{
    constructor(definition, source)
    {
        definition.kind = 'trigger-consumed';
        var targetNaming = [source.clusterName, definition.sector, definition.name];
        var naming = _.concat(source.naming, targetNaming);

        super(definition, naming, source, 'trigger', targetNaming);
    }

}

module.exports = ConsumedTrigger;
