const _ = require('the-lodash');
const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

class PolicyResolver
{
    constructor(policies)
    {
        this._policyMap = {};
        for(var x of policies) {
            if (!(x.name in this._policyMap)) {
                this._policyMap[x.name] = [];
            }
            this._policyMap[x.name].push(x);
        }
        this._defaultsMap = {};
    }

    resolve(name, target)
    {
        if (!this._policyMap) {
            throw new Error("Policy Resolver Not Ready");
        }
        var policies = this._scopePolicies(name, target);
        policies = _.orderBy(policies, x => x.getPriority(), 'desc');

        var definitions = _.map(policies, x => _.cloneDeep(x.definition));
        definitions.push(this._getDefault(name));
        var definition = _.defaultsDeep.apply(null, definitions);
        return definition;
    }    
    
    _scopePolicies(name, target)
    {
        var policies = this._getPolicies(name);
        policies = policies.filter(x => this._canApply(x, target));
        return policies;
    }

    _canApply(policy, target)
    {
        for(var key of _.keys(target))
        {
            var value = target[key];
            if (!this._canKeyApply(policy, key, value))
            {
                return false;
            }
        }
        return true;
    }

    _canKeyApply(policy, key, value)
    {
        if (_.isNullOrUndefined(value)) {
            return true;
        }

        if (value == "*") {
            return true;
        }

        var policyValue = policy.applicator[key];
        if (!policyValue) {
            return true;
        }
        if (policyValue == value) {
            return true;
        }

        return false;
    }

    _getPolicies(name)
    {
        if (name in this._policyMap) {
            return this._policyMap[name];
        }
        return [];
    }

    _getDefault(name)
    {
        if (!(name in this._defaultsMap)) {
            var polPath = path.join(__dirname, 'policy-defaults', name + '.yaml')
            if (fs.existsSync(polPath)) {
                this._defaultsMap[name] = YAML.load(polPath)
            } else {
                this._defaultsMap[name] = {}
            }
        }
        return _.cloneDeep(this._defaultsMap[name]);
    }
}

module.exports = PolicyResolver;