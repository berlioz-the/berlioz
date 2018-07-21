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

    clusters()
    {
        return this._getAllForKind('cluster');
    }

    getCluster(name) {
        return this.findByNaming('cluster', name);
    }

    getImage(cluster, image) {
        return this.findByNaming('image', [cluster, image]);
    }

    images()
    {
        return this._getAllForKind('image');
    }

    services()
    {
        return this._getAllForKind('service');
    }

    databases()
    {
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

    image_based()
    {
        return this.images().concat(this.services());
    }

    servicesForCluster(clusterName)
    {
        return this.services().filter(x => x.definition.cluster == clusterName);
    }

}

module.exports = Registry;
