const DockerBased = require('./docker-based');
const Base = require('./base');

class Image extends DockerBased
{
    constructor(definition)
    {
        super(definition);
    }

    get isSignificant() {
        return Base.parseBool(this.definition.significant);
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['isSignificant', this.isSignificant]);
    }
}

module.exports = Image;
