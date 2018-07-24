const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedEndpoint extends ConsumedBase
{
    constructor(definition, source)
    {
        var targetKind;
        var targetNaming;
        var naming = [source.clusterName, source.name];
        if (definition.cluster) {
            targetKind = 'cluster';
            targetNaming = [definition.cluster];
        } else {
            targetKind = 'service';
            targetNaming = [source.clusterName, definition.service];
        }

        naming.push(targetKind);
        naming = _.concat(naming, targetNaming);
        naming.push(definition.endpoint);

        definition.kind = 'service-consumed';

        super(definition, naming, source, targetKind, targetNaming);
    }

    get targetEndpoint() {
        return this.definition.endpoint;
    }

    get localTarget() {
        if (this.targetKind == 'service') {
            return this.registry.findById(this.targetId);
        }
        return null;
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['targetId', this.targetId]);
        data.push(['targetEndpoint', this.targetEndpoint]);
    }

}


module.exports = ConsumedEndpoint;
