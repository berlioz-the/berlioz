const _ = require('the-lodash');
const Base = require('./entities/base');

class Registry
{
    constructor()
    {
        this._registry = {};
        this.initPolicyResolver()
    }

    add(obj)
    {
        if (!this._registry[obj.kind]) {
            this._registry[obj.kind] = {};
        }
        // TODO: At some point enforce this.
        // if (obj.id in this._registry[obj.kind]) {
        //     console.log(`WARNING: ID ${obj.id} already present. existing from ${this._registry[obj.kind].berliozfile}, new from ${obj.berliozfile}`);
        // }
        if (this._kindHasMultipleInstances(obj.kind)) {
            if (!this._registry[obj.kind][obj.id]) {
                this._registry[obj.kind][obj.id] = []
            }
            this._registry[obj.kind][obj.id].push(obj);
        } else {
            this._registry[obj.kind][obj.id] = [obj];
        }
    }

    _kindHasMultipleInstances(kind)
    {
        if (kind == 'policy') {
            return true;
        }
        return false;
    }

    remove(obj)
    {
        if (this._registry[obj.kind]) {
            var dict = this._registry[obj.kind];
            if (dict[obj.id]) {
                delete dict[obj.id]
            }
        }
    }

    findById(id)
    {
        var idInfo = Base.breakID(id);
        return this._findById(idInfo.kind, id);
    }

    findByNaming(kind, naming)
    {
        var id = Base.constructID(kind, naming);
        return this._findById(kind, id);
    }

    _findById(kind, id)
    {
        if (!this._registry[kind]) {
            return null;
        }
        var entityArray = this._registry[kind][id];
        if (entityArray) {
            if (entityArray.length > 0) {
                return _.head(entityArray);
            }
        }
        return null;
    }

    initPolicyResolver()
    {
        const PolicyResolver = require('./policy-resolver');
        this._policyResolver = new PolicyResolver(this.policies);
    }

    resolvePolicy(name, target, mandatoryKeys)
    {
        return this._policyResolver.resolve(name, target, mandatoryKeys);
    }

    resolvePolicies(name, target, mandatoryKeys)
    {
        return this._policyResolver.extract(name, target, mandatoryKeys);
    }

    _getAllForKind(kind)
    {
        if (!this._registry[kind]) {
            return [];
        }
        var result = _.values(this._registry[kind]);
        result = _.flatten(result);
        return result;
    }

    get allItems() {
        var kinds = _.keys(this._registry);
        var items = kinds.map(x => this._getAllForKind(x));
        items = _.flatten(items);
        return items;
    }

    get clusters() {
        return this._getAllForKind('cluster');
    }

    get images() {
        return this._getAllForKind('image');
    }

    get services() {
        return this._getAllForKind('service');
    }

    get databases() {
        return this._getAllForKind('database');
    }

    get queues() {
        return this._getAllForKind('queue');
    }

    get secrets() {
        return this._getAllForKind('secret');
    }

    get lambdas() {
        return this._getAllForKind('lambda');
    }
    
    get triggers() {
        return this._getAllForKind('trigger');
    }

    get image_based() {
        return this.images.concat(this.services);
    }

    get policies() {
        return this._getAllForKind('policy');
    }

    servicesForCluster(clusterName)
    {
        return this.services.filter(x => x.definition.cluster == clusterName);
    }

    getCluster(name) {
        return this.findByNaming('cluster', name);
    }

    getImage(cluster, image) {
        return this.findByNaming('image', [cluster, image]);
    }

    extractPolicies()
    {
        var definitions = [];
        for(var item of this.policies)
        {
            if (!item.isImplicit) {
                definitions.push(item.definition);
            }
        }
        return definitions;
    }

    scopePolicies(target)
    {
        for(var policy of this.policies)
        {
            if (!this._policyResolver._canApply(policy, target))
            {
                this.remove(policy);
            }
        }
        this.initPolicyResolver();
        return Promise.resolve(this);
    }

    scopeCluster(name)
    {
        var clusterEntity = this.getCluster(name);
        if (!clusterEntity) {
            return Promise.resolve(null);
        }
        var clusterDefinitions = clusterEntity.extractDefinitions()
        var policyDefinitions = this.extractPolicies()
        var definitions = _.concat(clusterDefinitions, policyDefinitions)

        const Loader = require('./loader');
        var loader = new Loader(require('./logger').logger);
        return Promise.resolve(loader.fromDefinitions(definitions));
    }

    compile(logger, policyTarget)
    {
        const Compiler = require('./compiler');
        var compiler = new Compiler(logger, policyTarget);
        return compiler.process(this);
    }

    produceDeploymentRegistry(logger, policyTarget, clusterName)
    {
        return Promise.resolve(this)
            .then(registry => registry.scopePolicies(policyTarget))
            .then(registry => {
                return registry.scopeCluster(clusterName)
            })
            .then(registry => { 
                if (!registry) {
                    throw new Error(`Cluster: ${clusterName} not present`);
                }
                return registry.compile(logger, policyTarget)
            })
    }

}

module.exports = Registry;
