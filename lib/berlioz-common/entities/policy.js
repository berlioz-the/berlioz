const Base = require('./base');
const _ = require('the-lodash');

const TARGETS = [
    "deployment", 
    "region", 
    "cluster", 
    "sector", 
    "service", 
    "endpoint",
    "database",
    "queue",
    "trigger",
    "secret",
    "lambda"
]

class Policy extends Base
{
    constructor(definition)
    {
        Base.setupSector(definition)
        var naming = [definition.name];
        var applicator = {};
        for (var x of TARGETS) {
            var val = definition[x];
            if (val) {
                applicator[x] = val;
                naming.push(x);
                naming.push(val);
            }
        }
        super(definition, naming);
        this._applicator = applicator;
    }

    get name() {
        return this.definition.name;
    }

    get applicator() {
        return this.this._applicator;
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
    }

}


module.exports = Policy;
