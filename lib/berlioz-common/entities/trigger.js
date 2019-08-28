const Base = require('./base');
const _ = require('the-lodash');

class Trigger extends Base
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

    get schedule() {
        return this.definition.schedule;
    }

    get initializeEnabled() {
        return this.definition.initializeEnabled;
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['clusterName', this.clusterName]);
        data.push(['sectorName', this.sectorName]);
        data.push(['name', this.name]);
        data.push(['class', this.className]);
        data.push(['schedule', this.schedule]);
        data.push(['initializeEnabled', this.initializeEnabled]);
    }
    
    // #region Validation
    _getValidationSchema(Joi)
    {
        return Joi.object().keys({
            kind: Joi.string().required(),
            cluster: Joi.clusterName().required(),
            sector: Joi.sectorName(),
            name: Joi.triggerName().required(),

            schedule: Joi.string().required(),
            initializeEnabled: Joi.boolean(),

            consumes: Joi.array().items(Joi.object().keys({
                    lambda: Joi.lambdaName()
                })
            ),


        });
    }
    // #endregion
}


module.exports = Trigger;
