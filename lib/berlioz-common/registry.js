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
        this._registry[obj.kind][obj.id] = obj;
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
        if (!this._registry[idInfo.kind]) {
            return null;
        }
        return this._registry[idInfo.kind][id];
    }

    findByNaming(kind, naming)
    {
        if (!this._registry[kind]) {
            return null;
        }
        var id = Base.constructID(kind, naming);
        return this._registry[kind][id];
    }

    initPolicyResolver()
    {
        const PolicyResolver = require('./policy-resolver');
        this._policyResolver = new PolicyResolver(this.policies);
    }

    resolvePolicy(name, target)
    {
        return this._policyResolver.resolve(name, target);
    }

    _getAllForKind(kind)
    {
        if (!this._registry[kind]) {
            return [];
        }
        return _.values(this._registry[kind]);
    }

    _getKindSet(kind)
    {
        if (!this._registry[kind]) {
            this._registry[kind] = {};
        }
        return this._registry[kind];
    }

    get allItems() {
        var items = []
        for(var itemSet of _.values(this._registry))
        {
            for(var item of _.values(itemSet))
            {
                items.push(item);
            }
        }
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
        for(var policy of this._getAllForKind('policy'))
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
        // return n/ull;
    }

    compile(logger)
    {
        const Compiler = require('./compiler');
        var compiler = new Compiler(logger);
        return compiler.process(this);
    }

    produceDeploymentRegistry(logger, policyTarget, clusterName)
    {
        return Promise.resolve(this)
            .then(registry => registry.scopePolicies(policyTarget))
            .then(registry => {
                if (!registry) {
                    return null;
                }
                return registry.scopeCluster(clusterName)
            })
            .then(registry => { 
                if (!registry) {
                    return null;
                }
                return registry.compile(logger)
            })
    }

}

module.exports = Registry;
