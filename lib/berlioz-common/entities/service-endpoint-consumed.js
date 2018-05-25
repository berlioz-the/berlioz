const Base = require('./base');
const _ = require('the-lodash');

class ServiceEndpointConsumed extends Base
{
    constructor(definition, service)
    {
        var targetKind;
        var targetNaming;
        var naming = [service.clusterName, service.name];
        if (definition.cluster) {
            targetKind = 'cluster';
            targetNaming = [definition.cluster];
        } else {
            targetKind = 'service';
            targetNaming = [service.clusterName, definition.service];
        }

        naming.push(targetKind);
        naming = _.concat(naming, targetNaming);
        naming.push(definition.endpoint);

        definition.kind = 'service-consumed';
        super(definition, naming);
        this._service = service;
        this._targetKind = targetKind;
        this._targetNaming = targetNaming;
        this._targetEndpoint = this.definition.endpoint;
    }

    get service() {
        return this._service;
    }

    get targetKind() {
        return this._targetKind;
    }

    get targetNaming() {
        return this._targetNaming;
    }

    get targetId() {
        return Base.constructID(this.targetKind, this.targetNaming);
    }

    get targetEndpoint() {
        return this._targetEndpoint;
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


module.exports = ServiceEndpointConsumed;
