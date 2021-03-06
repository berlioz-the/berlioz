const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedSecret extends ConsumedBase
{
    constructor(definition, source)
    {
        definition.kind = 'secret-consumed';
        var targetNaming = [source.clusterName, definition.sector, definition.name];
        var naming = _.concat(source.naming, targetNaming);
        super(definition, naming, source, 'secret', targetNaming);
    }

}

module.exports = ConsumedSecret;
