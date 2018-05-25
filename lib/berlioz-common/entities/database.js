const Base = require('./base');
const _ = require('the-lodash');

class Database extends Base
{
    constructor(definition)
    {
        super(definition, [definition.cluster, definition.name]);

        this._massageAttributes();
    }

    get name() {
        return this.definition.name;
    }

    get clusterName() {
        return this.definition.cluster;
    }

    get cluster() {
        this.registry.findByNaming('cluster', this.clusterName);
    }

    get className() {
        return this.definition.class;
    }

    get subClassName() {
        return this.definition.subClass;
    }

    get attributes() {
        return this._attributes;
    }

    get hashKey() {
        return this.definition.hashKey;
    }

    get rangeKey() {
        return this.definition.rangeKey;
    }

    _massageAttributes()
    {
        this._attributes = [];

        if (this.definition.hashKey) {
            this._attributes.push({
                name: this.definition.hashKey.name,
                type: this.definition.hashKey.type,
                keyType: 'hash'
            })
        }

        if (this.definition.rangeKey) {
            this._attributes.push({
                name: this.definition.rangeKey.name,
                type: this.definition.rangeKey.type,
                keyType: 'range'
            })
        }
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
        data.push(['class', this.className]);
        data.push(['subClass', this.subClassName]);
    }

}


module.exports = Database;
