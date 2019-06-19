const Base = require('./base');
const _ = require('the-lodash');

class Queue extends Base
{
    constructor(definition)
    {
        Base.setupSector(definition)
        super(definition, [definition.cluster, definition.sector, definition.name]);
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

    extractData(data)
    {
        super.extractData(data);
        data.push(['clusterName', this.clusterName]);
        data.push(['sectorName', this.sectorName]);
        data.push(['name', this.name]);
        data.push(['class', this.className]);
        data.push(['subClass', this.subClassName]);
        data.push(['pairWithConsumer', this.pairWithConsumer]);
    }

     
    // #region Validation
    _getValidationSchema(Joi)
    {
        return Joi.object().keys({
            kind: Joi.string().required(),
            cluster: Joi.clusterName().required(),
            sector: Joi.sectorName(),
            name: Joi.queueName().required(),
            class: Joi.string().valid('queue').required(),
            subClass: Joi.string().valid('pubsub', 'kinesis', 'sqs').required(),

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
            )

        });
    }
    // #endregion

}


module.exports = Queue;
