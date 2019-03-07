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

        var config = {};
        if (definition.config) {
            config = definition.config;
        }

        var target = {};
        if (definition.target) {
            target = _.clone(definition.target);
        }
        if (definition.name == 'object-substitute') {
            if (!config.meta) {
                throw new Error("Meta is not set.");
            }
            target.meta = config.meta;
        }

        var targetNames = _.keys(target);
        targetNames.sort();
        for (var x of targetNames) {
            var val = target[x];
            if (val) {
                naming.push(x);
                if (_.isArray(val)) {
                    val = JSON.stringify(val);
                }
                naming.push(val);
            }
        }

        super(definition, naming);
        this._priority = null;

        this._config = config;
        this._target = target;
    }

    get name() {
        return this.definition.name;
    }

    get target() {
        return this._target;
    }
    
    get config() {
        return this._config;
    }

    getPriority() {
        if (this._priority == null) {
            this._priority = 0;
            for (var i = 0; i < TARGETS.length; i++) {
                var x = TARGETS[i];
                var val = this.target[x];
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
