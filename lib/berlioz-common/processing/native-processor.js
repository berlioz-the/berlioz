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
        this._processedItems = [];
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

    get items() {
        return _.values(this._items);
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
        this.logger.info("[constructConfig] %s...", clusterEntity.id);
        return Promise.resolve()
            .then(() => this._processItems(config, clusterEntity, this._constructNative.bind(this)))
            .then(() => Promise.serial(clusterEntity.services, service => {
                return this._processServiceConsumes(config, service);
            }))
            .then(() => Promise.serial(this._processedItems, x => this._massageNative(x.handler, x.args)))
            ;
        ;
    }

    _processServiceConsumes(config, service)
    {
        // this.logger.info("[_processServiceConsumes] %s...", service.id);
        return Promise.resolve()
            .then(() => this._processServiceConsumesList(config, service, service.databasesConsumes))
            .then(() => this._processServiceConsumesList(config, service, service.queuesConsumes));
    }

    _processServiceConsumesList(config, service, consumedItems)
    {
        return Promise.serial(consumedItems, x => this._processServiceConsumed(config, service, x))
    }

    _processServiceConsumed(config, service, consumed)
    {
        this.logger.info("[_processServiceConsumed] %s => %s...", service.id, consumed.id);
        var targetEntity = consumed.localTarget;
        if (!targetEntity) {
            this.logger.error("[_processServiceConsumed] Target Entity for %s is not present.", consumed.id);
            return;
        }
        this.logger.info("[_processServiceConsumed] %s...", targetEntity.id);

        var handler = this._getEntityHandler(targetEntity, 'consumed');
        if (!handler) {
            return;
        }

        var providerItem = this.getItem(targetEntity.id);

        return this._processHandler(handler, config, consumed, {
            consumer: service,
            targetEntity: targetEntity,
            providerItem: providerItem
        });
    }

    extractServiceConsumedItems(entity)
    {
        this.logger.info("[extractServiceConsumedItems] %s...", entity.id);
        var result = {};
        for(var consumed of entity.databasesConsumes)
        {
            this._extractConsumed(consumed, result);
        }
        for(var consumed of entity.queuesConsumes)
        {
            this._extractConsumed(consumed, result);
        }
        return result;
    }

    setupConsumedRelationsAndPeers(entity, peersMap, item)
    {
        var consumedMap = this.extractServiceConsumedItems(entity);
        this.logger.info('[setupConsumedRelationsAndPeers] %s, consumedMapKeys: ', entity.id, _.keys(consumedMap));
        return Promise.resolve()
            .then(() => Promise.serial(_.values(consumedMap), consumedItem => {
                this.logger.info('[setupConsumedRelationsAndPeers] ', consumedItem.info);
                peersMap[consumedItem.info.id] = {
                    "0" : consumedItem.info
                };
                return Promise.resolve()
                    .then(() => {
                        var relRuntime = {
                            entityId: consumedItem.info.id,
                            propertyTag: 'name'
                        }
                        return item.relation(consumedItem.item.meta.name, consumedItem.item.naming, null, relRuntime)
                            .then(rel => rel.markIgnoreDelta())
                    }) 
                    .then(() => {
                        if (!consumedItem.consumedItem) {
                            return;
                        }
                        var relRuntime = {
                            entityId: consumedItem.info.id,
                            propertyTag: 'subName'
                        }
                        return item.relation(consumedItem.consumedItem.meta.name, consumedItem.consumedItem.naming, null, relRuntime)
                            .then(rel => rel.markIgnoreDelta())
                    }) 
                    ;
            }))
    }

    autoConfigConsumerPeers(item, peersMap)
    {
        for(var relation of item.relations)
        {
            if (!relation.runtime) {
                continue;
            }
            if (!relation.runtime.entityId) {
                continue;
            }
            if (!relation.targetItem) {
                continue;
            }
            var entityPeersDict = peersMap[relation.runtime.entityId];
            if (!entityPeersDict) {
                continue;
            }
            entityPeersDict["0"][relation.runtime.propertyTag] = 
                relation.targetItem.id;
        }
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

            var consumedItem = this.getItem(consumedEntity.id);
            result[consumedEntity.targetId] = {
                info: itemConfig,
                consumedEntity: consumedEntity,
                item: item,
                consumedId: consumedEntity.id,
                consumedItem: consumedItem
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

        return this._processHandler(handler, config, entity);
    }

    _processHandler(handler, config, entity, handlerArgs)
    {
        this.logger.info("[_processHandler] Running handler for %s...", entity.id);

        if (!handlerArgs) {
            handlerArgs = {};
        }
        handlerArgs.config = config;
        handlerArgs.entity = entity;
        handlerArgs.scope = this._scope;

        if (handler.checkSkip)
        {
            if (!handler.checkSkip(handlerArgs))
            {
                return;
            }
        }

        if (handler.customCreate) {
            return Promise.resolve(handler.customCreate(handlerArgs))
                .then(item => {
                    if (!item) {
                        throw new Error("NativeProcessor. No item returned from custom-processor for " + entity.id);
                    }
                    this._reportNewItem(entity, item);
                    this._processedItems.push({
                        handler: handler,
                        args: handlerArgs
                    })
                })
        } else {
            if (!handler.getModelName) {
                throw new Error("NativeProcessor. Missing getModelName in processor for " + entity.id);
            }
            var modelName = handler.getModelName(handlerArgs);
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
            var naming = handler.getNaming(handlerArgs);
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

                this._processedItems.push({
                    handler: handler,
                    args: handlerArgs
                })
            }

            if(handler.setupItem) {
                handlerArgs.item = item; 
                return handler.setupItem(handlerArgs);
            }
        }
    }

    _massageNative(handler, handlerArgs)
    {
        if (!handler.massageItem) {
            return;
        }
        this.logger.info("[_massageNative] %s...", handlerArgs.entity.id);
        return handler.massageItem(handlerArgs);
    }
    
    _getEntityHandler(entity, flavor)
    {
        var pathParts = ['./native-processors',
            this.providerKind,
            entity.kind,
            entity.className,
            entity.subClassName];
        var relPath = pathParts.join('/');
        if (flavor) {
            relPath = relPath + '.' + flavor;
        }
        var entityHandler = optionalRequire(relPath);
        if (!entityHandler) {
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