const Base = require('./base');
const Path = require('path');

class DockerBased extends Base
{
    constructor(definition)
    {
        super(definition, [definition.cluster, definition.name]);
    }

    get name() {
        return this.definition.name;
    }

    get clusterName() {
        return this.definition.cluster;
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
        data.push(['extendSymlinks', this.extendSymlinks]);
    }

}


module.exports = DockerBased;
