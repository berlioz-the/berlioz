const Base = require('./base');
const _ = require('the-lodash');

class ServiceDatabaseConsumed extends Base
{
    constructor(definition, service)
    {
        definition.kind = 'database-consumed';
        var naming = [service.clusterName, service.name, definition.name];
        super(definition, naming);
        this._targetNaming = [service.clusterName, definition.name];
        this._service = service;
    }

    get service() {
        return this._service;
    }

    get targetKind() {
        return 'database';
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


module.exports = ServiceDatabaseConsumed;
