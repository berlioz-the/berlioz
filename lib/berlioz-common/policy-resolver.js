const _ = require('the-lodash');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class PolicyResolver
{
    constructor(policies)
    {
        this._policyMap = _.groupBy(policies, x => x.name);
        // for(var x of policies) {
        //     if (!(x.name in this._policyMap)) {
        //         this._policyMap[x.name] = [];
        //     }
        //     this._policyMap[x.name].push(x);
        // }
        this._defaultsMap = {};
    }

    resolve(name, target, mandatoryKeys)
    {
        var configs = this.extract(name, target, mandatoryKeys)
        configs.push(this._getDefault(name));
        var config = _.defaultsDeep.apply(null, configs);
        return config;
    }    
    
    extract(name, target, mandatoryKeys)
    {
        if (!this._policyMap) {
            throw new Error("Policy Resolver Not Ready");
        }
        var policies = this._scopePolicies(name, target, mandatoryKeys);
        var configs = _.map(policies, x => _.cloneDeep(x.config));
        return configs;
    }
    
    _scopePolicies(name, target, mandatoryKeys)
    {
        var policies = this._getPolicies(name);
        policies = policies.filter(x => this._canApply(x, target, mandatoryKeys));
        policies = _.orderBy(policies, x => x.getPriority(), 'desc');
        return policies;
    }

    _canApply(policy, target, mandatoryKeys)
    {
        if (target) {
            for(var key of _.keys(target))
            {
                var value = target[key];
                if (!this._canKeyApply(policy, key, value))
                {
                    return false;
                }
            }
        }
        if (mandatoryKeys) {
            for(var key of mandatoryKeys) {
                if (!(key in policy.target)) {
                    return;
                }
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

        var policyValue = policy.target[key];
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
                var fileContentsStr = fs.readFileSync(polPath);
                this._defaultsMap[name] = yaml.safeLoad(fileContentsStr);
            } else {
                this._defaultsMap[name] = {}
            }
        }
        return _.cloneDeep(this._defaultsMap[name]);
    }
}

module.exports = PolicyResolver;