const Base = require('./base');
const Path = require('path');

class DockerBased extends Base
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
        return this.registry.findByNaming('cluster', this.clusterName);
    }

    get sectorName() {
        return this.definition.sector;
    }

    get sector() {
        this.registry.findByNaming('sector', [this.clusterName, this.sectorName]);
    }

    get image() {
        return this.clusterName + '-' + this.name;
    }

    get dockerfile() {
        if (!this.path) {
            return null;
        }
        return Path.join(this.path, 'Dockerfile');
    }

    get code() {
        if (!this.definition.code) {
            return {};
        }
        return this.definition.code;
    }

    get extendSymlinks() {
        if (this.code.extendSymlinks) {
            return true;
        }
        return false;
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
        data.push(['image', this.image]);
        data.push(['dockerfile', this.dockerfile]);
        data.push(['clusterName', this.clusterName]);
        data.push(['sectorName', this.sectorName]);
        data.push(['extendSymlinks', this.extendSymlinks]);
    }

}


module.exports = DockerBased;
