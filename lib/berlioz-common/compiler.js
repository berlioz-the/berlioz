const Path = require('path');
const _ = require('the-lodash');
const Promise = require('the-promise');
const BaseItem = require('./entities/base')

class Compiler
{
    constructor(logger, policyTarget)
    {
        this._logger = logger;
        this._policyTarget = policyTarget;
        if (!this._policyTarget) {
            this._policyTarget = {};
        }

        require('./logger').logger = logger;
        const Loader = require('./loader')
        this._loader = new Loader(logger);

        this._stages = [ ]

        this._register("extend-gcp-sql-storage");
        this._register("extend-prometheus");
        this._register("extend-grafana");
        this._register("extend-zipkin");
        this._register("extend-k8s-controller");
        this._register("extend-agent");
        this._register("extend-aws-log-secret");
    }

    get loader() {
        return this._loader;
    }

    get policyTarget() {
        return this._policyTarget;
    }

    get hasSingleBerliozAgent() {
        if (this.policyTarget.providerKind == 'aws') {
            return false;
        }
        if (this.policyTarget.providerKind == 'local') {
            return false;
        }
        return true;
    }
    
    _register(name)
    {
        var mod = require("./compilers/" + name);
        this._stages.push(mod);
    }

    process(registry)
    {
        this._registry = registry;

        for(var stage of this._stages)
        {
            this._logger.info('[Compiler::process] %s...', stage.name)
            this._processStage(stage);
        }

        return this._registry;
    }

    _processStage(stage)
    {
        this._items = {};
        for (var item of this._registry.allItems)
        {
            if (item.isImplicit) {
                continue;
            }
            this._items[item.id] = {
                berliozfile:  item._berliozfile,
                isCompiled: item.isCompiled,
                definition: _.clone(item.definition),
            }
        }

        this._processStageGlobal(stage);
        
        if (stage.clusterAction)
        {
            for(var cluster of this._registry.clusters)
            {
                if (stage.canRun) {
                    if (!stage.canRun({compiler: this, registry: this._registry, cluster: cluster})) {
                        continue;
                    }
                }
                stage.clusterAction({compiler: this, registry: this._registry, cluster: cluster})
            }
        }

        return this._produceRegistry();
    }

    _processStageGlobal(stage)
    {
        if (!stage.globalAction) {
            return;
        }
        if (stage.canRun) {
            if (!stage.canRun({compiler: this, registry: this._registry})) {
                return;
            }
        } 
        stage.globalAction({compiler: this, registry: this._registry})
    }

    _produceRegistry()
    {
        const Registry = require('./registry');
        this._registry = new Registry();
        for (var itemInfo of _.values(this._items))
        {
            var obj = this._loader.parseDefinition(itemInfo.definition);
            if (obj) {
                if (itemInfo.berliozfile) {
                    obj.setPath(itemInfo.berliozfile);
                }
                if (itemInfo.isCompiled) {
                    obj._isCompiled = true;
                }
                obj.addToRegistry(this._registry);
            }
        }
        this._loader.postProcess(this._registry);
    }

    _addImpicit(definition)
    {
        var obj = this._loader.parseDefinition(definition);
        if (obj) {
            this._items[obj.id] = {
                isCompiled: true,
                definition: definition
            }
            return obj.id;
        } else {
            throw new Error('Error constructing compiled definition.');
        }
    }

    _get(id)
    {
        return this._items[id];
    }

    _findById(id)
    {
        return this._registry.findById(id);
    }

    _findByNaming(kind, naming) 
    {
        var id = BaseItem.constructID(kind, naming);
        return this._findById(id);
    }

    _addConsumes(id, consumed)
    {
        var info = this._get(id);
        if (!info.definition.consumes) {
            info.definition.consumes = []
        }
        info.definition.consumes.push(consumed);
    }
    
    _addClusterProvided(clusterName, name, provided)
    {
        var info = this._fetchCluster(clusterName);
        if (!info.definition.provides) {
            info.definition.provides = []
        }
        info.definition.provides[name] = provided;
    }

    _fetchCluster(name)
    {
        var id = BaseItem.constructID('cluster', [name]);
        var info = this._get(id);
        if (!info) {
            this._addImpicit({
                kind: 'cluster',
                name: name
            });
            info = this._get(id);
        }
        return info;
    }

    _markClusterImplicit(name)
    {
        var info = this._fetchCluster(name);
        info.isCompiled = true;
    }

}

module.exports = Compiler;
