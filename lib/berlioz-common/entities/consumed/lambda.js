const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedLambda extends ConsumedBase
{
    constructor(definition, source)
    {
        definition.kind = 'lambda-consumed';
        var targetNaming = [source.clusterName, definition.sector, definition.name];
        var naming = _.concat(source.naming, targetNaming);

        super(definition, naming, source, 'lambda', targetNaming);
    }

}

module.exports = ConsumedLambda;
