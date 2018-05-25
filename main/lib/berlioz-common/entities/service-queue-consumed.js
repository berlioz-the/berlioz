const Base = require('./base');
const _ = require('the-lodash');

class ServiceQueueConsumed extends Base
{
    constructor(definition, service)
    {
        definition.kind = 'queue-consumed';
        var naming = [service.clusterName, service.name, definition.name];
        super(definition, naming);
        this._targetNaming = [service.clusterName, definition.name];
        this._service = service;
    }

    get service() {
        return this._service;
    }

    get targetKind() {
        return 'queue';
    }

    get targetNaming() {
        return this._targetNaming;
    }

    get targetId() {
        return Base.constructID(this.targetKind, this.targetNaming);
    }

    get localTarget() {
        return this.registry.findById(this.targetId);
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['targetId', this.targetId]);
    }

}

module.exports = ServiceQueueConsumed;
