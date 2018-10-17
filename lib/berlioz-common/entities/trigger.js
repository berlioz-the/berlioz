const Base = require('./base');
const _ = require('the-lodash');

class Trigger extends Base
{
    constructor(definition)
    {
        Base.setupSector(definition)
        super(definition, [definition.cluster, definition.sector, definition.name]);
        this._massageConsumesConfig()
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

    get lambdaConsumes() {
        return this.getLinks('lambda-consumed');
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

    _massageConsumesConfig()
    {
        this._loadConsumesConfig(this.definition.consumes)
    }
}


module.exports = Trigger;
