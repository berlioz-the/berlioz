const _ = require('the-lodash');
const Base = require('./entities/base');

class Registry
{
    constructor()
    {
        this._registry = {};
    }

    add(obj)
    {
        if (!this._registry[obj.kind]) {
            this._registry[obj.kind] = {};
        }
        this._registry[obj.kind][obj.id] = obj;
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

}

module.exports = Registry;
