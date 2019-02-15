const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedMeta extends ConsumedBase
{
    constructor(definition, source)
    {
        definition.kind = 'meta-consumed';
        var clusterName = source.clusterName;
        var sectorName = definition.sector;
        if (!sectorName) {
            sectorName = source.sectorName;
        }
        var targetNaming = [clusterName, sectorName];
        var naming = _.concat(source.naming, targetNaming);
        super(definition, naming, source, 'sector', targetNaming);
    }

}


module.exports = ConsumedMeta;
