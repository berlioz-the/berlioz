const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedMeta extends ConsumedBase
{
    constructor(definition, source)
    {
        definition.kind = 'meta-consumed';
        var targetNaming = [source.clusterName, definition.sector];
        var naming = _.concat(source.naming, targetNaming);
        super(definition, naming, source, 'sector', targetNaming);
    }

}


module.exports = ConsumedMeta;
