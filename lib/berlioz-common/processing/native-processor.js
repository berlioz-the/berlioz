const Promise = require("the-promise");
const _ = require("the-lodash");
const Path = require("path");
const optionalRequire = require("optional-require")(require);

class NativeProcessor
{
    constructor(logger)
    {
        this._logger = logger;
        this._scope = {};
        this._items = {};
        this._entities = {};
        this._providerPeerConfigOverride = {};
    }

    get logger() {
        return this._logger;
    }

    get providerKind() {
        return this._scope.providerKind;
    }

    get deployment() {
        return this._scope.deployment;
    }

    setupScope(scope) {
        this._scope = _.clone(scope);
    }

    setupProviderPeerConfigOverride(name, config) {
        this._providerPeerConfigOverride[name] = config;
    }

    constructConfig(config, clusterEntity)
    {
        if (!this.providerKind) {
            throw new Error("ProviderKind not set");
        }
        this.logger.info("[constructConfig] %s...", clusterEntity);
        return Promise.resolve()
            .then(() => this._processItems(config, clusterEntity, this._constructNative.bind(this)))
            .then(() => this._processItems(config, clusterEntity, this._massageNative.bind(this)))
        ;
    }

    extractServiceConsumedItems(serviceEntity)
    {
        this.logger.info("[extractServiceConsumedItems] %s...", serviceEntity.id);
        var result = {};
        for(var consumed of serviceEntity.databasesConsumes)
        {
            this._extractConsumed(consumed, result);
        }
        for(var consumed of serviceEntity.queuesConsumes)
        {
            this._extractConsumed(consumed, result);
        }
        return result;
    }

    _extractConsumed(consumedEntity, result)
    {
        this.logger.info("[_extractConsumed] %s => %s...", consumedEntity.id, consumedEntity.targetId);
        var item = this.getItem(consumedEntity.targetId) 
        if (item) {
            var entity = this.getEntity(consumedEntity.targetId);
            var itemConfig = {
                id: entity.id,
                kind: entity.kind,
                class: entity.className,
                subClass: entity.subClassName
            };
            if (this.providerKind in this._providerPeerConfigOverride) {
                itemConfig.config = this._providerPeerConfigOverride[this.providerKind];
            }
            result[consumedEntity.targetId] = {
                info: itemConfig,
                item: item
            };
        }
    }

    _processItems(config, clusterEntity, action)
    {
        return Promise.resolve()
            .then(() => Promise.serial(clusterEntity.databases, x => this._processItem(config, x, action)))
            .then(() => Promise.serial(clusterEntity.queues, x => this._processItem(config, x, action)))
    }

    _processItem(config, clusterEntity, action)
    {
        return action(config, clusterEntity);
    }

    _constructNative(config, entity)
    {
        this.logger.info("[_constructNative] %s...", entity.id);
        var handler = this._getEntityHandler(entity);
        if (!handler) {
            this.logger.error("[_constructNative] Handler for %s is not present.", entity.id, entity.definition);
            return;
        }

        if (handler.customCreate) {
            return Promise.resolve(handler.customCreate(config, entity, this._scope))
                .then(item => {
                    if (!item) {
                        throw new Error("NativeProcessor. No item returned from custom-processor for " + entity.id);
                    }
                    this._reportNewItem(entity, item)
                })
        } else {

            if (!handler.getModelName) {
                throw new Error("NativeProcessor. Missing getModelName in processor for " + entity.id);
            }
            var modelName = handler.getModelName(entity, this._scope);
            if (!modelName) {
                throw new Error("NativeProcessor. Invalid modelName returned from processor for " + entity.id);
            }

            if (!(modelName in config.meta._sections)) {
                this.logger.error("Meta %s not present in config. Used by: %s. Skipping.", modelName, entity.id);
                return;
            }

            if (!handler.getNaming) {
                throw new Error("NativeProcessor. Missing getNaming in processor for " + entity.id);
            }
            var naming = handler.getNaming(entity, this._scope);
            if (!naming) {
                throw new Error("NativeProcessor. Invalid naming returned from processor for " + entity.id);
            }

            if (handler.massageNamingPart) {
                naming = naming.map(x => handler.massageNamingPart(x));
            }

            var item = config.find(modelName, naming);
            if (!item) {
                item = config.section(modelName).create(naming);
                this._reportNewItem(entity, item);
            }

            if(handler.setupItem) {
                return handler.setupItem(config, entity, item, this._scope)
            }
        }
    }

    _massageNative(config, entity)
    {
        this.logger.info("[_massageNative] %s...", entity.id);
        var item = this.getItem(entity.id);
        if (!item) {
            return;
        }

        var handler = this._getEntityHandler(entity);
        if (!handler) {
            this.logger.error("[_constructNative] Handler for %s is not present.", entity.id, entity.definition);
            return;
        }

        if (!handler.massageItem) {
            return;
        }

        return handler.massageItem(config, entity, item, this._scope);
    }
    
    _getEntityHandler(entity)
    {
        var pathParts = ['./native-processors',
            this.providerKind,
            entity.kind,
            entity.className,
            entity.subClassName];
        var relPath = pathParts.join('/');
        var entityHandler = optionalRequire(relPath);
        if (!entityHandler) {
            this.logger.error("[_getEntityHandler] Missing handler for %s. relPath: %s", entity.id, relPath);
            return null;
        }
        return entityHandler;
    }

    _reportNewItem(entity, item)
    {
        if (!entity) {
            throw new Error("Entity not set.");
        }
        if (!item) {
            throw new Error("Item not set.");
        }
        this.logger.info("[_reportNewItem] created %s for %s...", item.dn, entity.id);
        this._items[entity.id] = item;
        this._entities[entity.id] = entity;
    }

    getItem(entityId) 
    {
        var item = this._items[entityId];
        if (!item) {
            return null;
        }
        return item;
    }

    getEntity(entityId) 
    {
        var entity = this._entities[entityId];
        if (!entity) {
            return null;
        }
        return entity;
    }

}

module.exports = NativeProcessor;