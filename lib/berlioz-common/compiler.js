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

    hasItem(id)
    {
        if (id in this._items) {
            return true;
        }
        return false;
    }
    
    _register(name)
    {
        var mod = require("./compilers/" + name);
        this._stages.push(mod);
    }

    process(registry)
    {
        this._registry = registry;
        this._logger.info('[Compiler::process] Begin...')

        for(var stage of this._stages)
        {
            this._logger.info('[Compiler::process] Stage: %s...', stage.name)
            this._processStage(stage);
        }

        this._logger.info('[Compiler::process] End.')

        return this._registry;
    }

    _processStage(stage)
    {
        this._items = {};
        this._policies = [];
        for (var item of this._registry.allItems)
        {
            if (item.isImplicit) {
                continue;
            }
            var itemInfo = {
                berliozfile:  item._berliozfile,
                isCompiled: item.isCompiled,
                definition: _.clone(item.definition),
            };
            if (item.kind == 'policy') {
                this._policies.push(itemInfo);
            } else {
                this._items[item.id] = itemInfo;
            }
        }

        this._processStageGlobal(stage);
        
        if (stage.clusterAction)
        {
            for(var cluster of this._registry.clusters)
            {
                if (stage.canRunCluster) {
                    if (!stage.canRunCluster(this._getContext(cluster))) {
                        continue;
                    }
                }
                this._logger.info('[Compiler::process] %s, running %s cluster action...', stage.name, cluster.name);
                stage.clusterAction(this._getContext(cluster))
            }
        }

        return this._produceRegistry();
    }

    _processStageGlobal(stage)
    {
        if (!stage.globalAction) {
            return;
        }
        if (stage.canRunGlobal) {
            if (!stage.canRunGlobal(this._getContext())) {
                return;
            }
        } 

        this._logger.info('[Compiler::process] %s, running global action...', stage.name)
        stage.globalAction(this._getContext())
    }

    _getContext(cluster)
    {
        var providerKind = this._policyTarget.providerKind;
        if (!providerKind) {
            providerKind = null;
        } 
        var context = {
            compiler: this, 
            registry: this._registry, 
            logger: this._logger,
            policyTarget: this._policyTarget,
            providerKind: providerKind
        };

        if (cluster)
        {
            context.cluster = cluster;
        }

        return context;
    }

    _produceRegistry()
    {
        this._registry = this._loader.newRegistry();
        for (var itemInfo of _.values(this._items))
        {
            this._addToRegistry(itemInfo);
        }
        for (var itemInfo of this._policies)
        {
            this._addToRegistry(itemInfo);
        }
        this._loader.postProcess(this._registry);
    }

    _addToRegistry(itemInfo)
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

    findById(id)
    {
        return this._registry.findById(id);
    }

    findByNaming(kind, naming) 
    {
        var id = BaseItem.constructID(kind, naming);
        return this.findById(id);
    }

    addConsumes(id, consumed)
    {
        var info = this._get(id);
        if (!info.definition.consumes) {
            info.definition.consumes = []
        }
        info.definition.consumes.push(consumed);
    }
    
    addClusterProvided(clusterName, name, provided)
    {
        var info = this.fetchCluster(clusterName);
        if (!info.definition.provides) {
            info.definition.provides = {}
        }
        info.definition.provides[name] = provided;
    }

    fetchCluster(name)
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

    markClusterImplicit(name)
    {
        this._logger.info('[markClusterImplicit] %s...', name)
        var info = this.fetchCluster(name);
        info.isCompiled = true;
    }

}

module.exports = Compiler;
