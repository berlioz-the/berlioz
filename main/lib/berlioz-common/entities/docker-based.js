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

    onPathSet()
    {
        // super();
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
        data.push(['image', this.image]);
        data.push(['dockerfile', this.dockerfile]);
        data.push(['clusterName', this.clusterName]);
    }

}


module.exports = DockerBased;
