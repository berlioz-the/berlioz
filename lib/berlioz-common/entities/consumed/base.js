const Base = require('../base');
const _ = require('the-lodash');

class ConsumedBase extends Base
{
    constructor(definition, naming, source, targetKind, targetNaming)
    {
        super(definition, naming);
        this._source = source;
        this._targetKind = targetKind;
        this._targetNaming = targetNaming;
        this._targetId = Base.constructID(targetKind, targetNaming);
        this._isImplicit = true;
    }

    get service() {
        return this._source;
    }

    get source() {
        return this._source;
    }

    get sourceId() {
        return this.source.id;
    }

    get targetKind() {
        return this._targetKind;
    }

    get targetNaming() {
        return this._targetNaming;
    }

    get targetId() {
        return this._targetId;
    }

    get localTarget() {
        return this.registry.findById(this.targetId);
    }

    get isLocalTargetPressent() {
        return _.isNotNullOrUndefined(this.localTarget);
    }

    get actions() {
        if (!this.definition.actions) {
            return [];
        }
        return this.definition.actions;
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['sourceId', this.sourceId]);
        data.push(['targetId', this.targetId]);
        data.push(['isPresent', this.isLocalTargetPressent]);
        data.push(['actions', this.actions]);
    }
}

module.exports = ConsumedBase;
