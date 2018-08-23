const ConsumedBase = require('./base');
const _ = require('the-lodash');

class ConsumedEndpoint extends ConsumedBase
{
    constructor(definition, source)
    {
        if (!definition.endpoint) {
            definition.endpoint = 'default';
        }
        
        var targetKind;
        var targetNaming;
        var naming = _.clone(source.naming);
        if (definition.cluster) {
            targetKind = 'cluster';
            targetNaming = [definition.cluster];
        } else {
            targetKind = 'service';
            targetNaming = [source.clusterName, definition.sector, definition.service];
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

    get isolation() {
        return this.definition.isolation;
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
        data.push(['isolation', this.isolation]);
    }

}


module.exports = ConsumedEndpoint;
