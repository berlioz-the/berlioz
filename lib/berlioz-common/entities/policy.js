const Base = require('./base');
const _ = require('the-lodash');

const TARGETS = [
    "deployment", 
    "cluster", 
    "region", 
    "sector", 
    "service", 
    "endpoint",
    "database",
    "client",
    "queue",
    "trigger",
    "secret",
    "lambda",
    "meta",
    "target"
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
                if (_.isArray(val)) {
                    val = JSON.stringify(val);
                }
                naming.push(val);
            }
        }
        super(definition, naming);
        this._applicator = applicator;
        this._priority = null;
    }

    get name() {
        return this.definition.name;
    }

    get applicator() {
        return this._applicator;
    }

    getPriority() {
        if (this._priority == null) {
            this._priority = 0;
            for (var i = 0; i < TARGETS.length; i++) {
                var x = TARGETS[i];
                var val = this.definition[x];
                if (val && (val != '*')) {
                    this._priority += Math.pow(2, TARGETS.length - i);
                }
            }
        }
        return this._priority;
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
    }

}


module.exports = Policy;
