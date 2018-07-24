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
        return Base.constructID(this.targetKind, this.targetNaming);
    }

    get localTarget() {
        return this.registry.findById(this.targetId);
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['sourceId', this.sourceId]);
        data.push(['targetId', this.targetId]);
    }
}

module.exports = ConsumedBase;
