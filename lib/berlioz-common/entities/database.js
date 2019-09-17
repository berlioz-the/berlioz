const Base = require('./base');
const _ = require('the-lodash');

class Database extends Base
{
    constructor(definition)
    {
        Base.setupSector(definition)
        super(definition, [definition.cluster, definition.sector, definition.name]);

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

    get sectorName() {
        return this.definition.sector;
    }

    get sector() {
        this.registry.findByNaming('sector', [this.clusterName, this.sectorName]);
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

    get dynamoTriggers() {
       if (!this.definition.trigger) {
           return [];
       }
       if (_.isArray(this.definition.trigger)) {
           return this.definition.trigger
       }
       return [this.definition.trigger];
    }

    get hasInitScript() {
        if (this.definition.init) {
            return true;
        }
        return false;
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

    _getPolicyTarget()
    {
        return {
            cluster: this.clusterName,
            sector: this.sectorName,
            database: this.name
        };
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['clusterName', this.clusterName]);
        data.push(['sectorName', this.sectorName]);
        data.push(['name', this.name]);
        data.push(['class', this.className]);
        data.push(['subClass', this.subClassName]);
    }

    
    // #region Validation
    _getValidationSchema(Joi)
    {
        return Joi.object().keys({
            kind: Joi.string().required(),
            cluster: Joi.clusterName().required(),
            sector: Joi.sectorName(),
            name: Joi.databaseName().required(),
            class: Joi.string().valid('nosql', 'sql', 'storage').required(),
            subClass: Joi.string().valid('dynamodb', 'firestore', 'sql', 's3', 'storage').required(),

            // SQL
            init: Joi.string(),

            // DynamoDB
            hashKey: Joi.object().keys({
                name: Joi.string(),
                type: Joi.string()
            }),
            rangeKey: Joi.object().keys({
                name: Joi.string(),
                type: Joi.string()
            }),
            trigger: Joi.array().items(Joi.object().keys({
                    lambda: Joi.string(),
                    'batch-size': Joi.number().integer()
                })
            ),

            config: Joi.object()

        });
    }
    // #endregion
}


module.exports = Database;
