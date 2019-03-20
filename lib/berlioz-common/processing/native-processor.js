const Promise = require("the-promise");
const _ = require("the-lodash");
const Path = require("path");
const fs = require("fs");
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
        this._policyHandlers = {};
        this._repositories = {};
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
        this._scope.nativeProcessor = this;
    }

    setupDesiredConfig(value)
    {
        this._desiredConfig = value;
    }

    setupRepositories(value)
    {
        this._repositories = value;
    }

    setupProviderPeerConfigOverride(name, config) {
        this._providerPeerConfigOverride[name] = config;
    }

    init()
    {
        this.logger.info("[init] %s...");
        return Promise.resolve()
            .then(() => this._loadPolicyHandlers());
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
                return this._processConsumes(config, service);
            }))
            .then(() => Promise.serial(clusterEntity.databases, database => {
                return this._processConsumes(config, database);
            }))
            .then(() => Promise.serial(this._processedItems, x => this._massageNative(x.handler, x.args)))
            ;
        ;
    }

    _processConsumes(config, consumer)
    {
        // this.logger.info("[_processConsumes] %s...", consumer.id);
        return Promise.resolve()
            .then(() => this._processConsumesList(config, consumer, consumer.databasesConsumes))
            .then(() => this._processConsumesList(config, consumer, consumer.queuesConsumes));
    }

    _processConsumesList(config, consumer, consumedItems)
    {
        return Promise.serial(consumedItems, x => this._processEntityConsumed(config, consumer, x))
    }

    _processEntityConsumed(config, consumer, consumed)
    {
        this.logger.info("[_processEntityConsumed] %s => %s...", consumer.id, consumed.id);
        var targetEntity = consumed.localTarget;
        if (!targetEntity) {
            this.logger.error("[_processEntityConsumed] Target Entity for %s is not present.", consumed.id);
            return;
        }
        this.logger.info("[_processEntityConsumed] %s...", targetEntity.id);

        var handler = this._getEntityHandler(targetEntity, 'consumed');
        if (!handler) {
            return;
        }

        var providerItem = this.getItem(targetEntity.id);
        var consumerItem = this.getItem(consumer.id);

        return this._processHandler(handler, config, consumed, {
            consumer: consumer,
            targetEntity: targetEntity,
            providerItem: providerItem,
            consumerItem: consumerItem
        }, true);
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

            var targetItem = relation.targetItem;
            if (!targetItem) {
                continue;
            }
            if (!targetItem.id) {
                continue;
            }
            var peer = entityPeersDict["0"];

            peer[relation.runtime.propertyTag] = targetItem.id;

            if (targetItem.meta.name == 'gcp-sql')
            {
                peer.config = {
                    user : 'root',
                    socketPath : `/cloudsql/${targetItem.obj.connectionName}`
                }
            }
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

        return Promise.resolve(this._processHandler(handler, config, entity, {}, true))
            .then(() => {
                var dependentHandler = this._getEntityHandler(entity, 'dependent');
                if (!dependentHandler) {
                    return;
                }
                var item = this.getItem(entity.id);
                return this._processHandler(dependentHandler, config, entity, {
                    ownerItem: item
                }, false)
            });
    }

    _processHandler(handler, config, entity, handlerArgs, shouldRegisterItem)
    {
        this.logger.info("[_processHandler] Running handler for %s...", entity.id);

        if (!handlerArgs) {
            handlerArgs = {};
        }
        handlerArgs.logger = this.logger;
        handlerArgs.processor = this;
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
                    if (shouldRegisterItem) {
                        this._reportNewItem(entity, item);
                    }
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
            this.logger.info("[_processHandler] initial naming: ", naming);

            if (handler.massageNamingPart) {
                naming = naming.map(x => handler.massageNamingPart(x));
            }
            this.logger.info("[_processHandler] final naming: ", naming);

            var item = config.find(modelName, naming);
            if (!item) {
                item = config.section(modelName).create(naming);
                if (shouldRegisterItem) {
                    this._reportNewItem(entity, item);
                }

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

    _loadPolicyHandlers()
    {
        var pathParts = [__dirname,
            'policy-handlers',
            this.providerKind];
        var dirPath = Path.join.apply(null, pathParts);
        var files = fs.readdirSync(dirPath)
        return Promise.serial(files, file => {
            var metaName = _.replace(file, '.js', '');
            var includePathParts = _.clone(pathParts);
            includePathParts.push(metaName);
            var includePath = includePathParts.join('/');
            this.logger.info("[_loadPolicyHandlers] loading %s from %s...", metaName, includePath);
            var handlerModule = require(includePath);
            var handler = handlerModule(this._scope);
            this._policyHandlers[metaName] = handler;
        });
    }

    getPolicyHandlerNames()
    {
        return _.keys(this._policyHandlers);
    }

    getPolicyHandler(metaName)
    {
        if (metaName in this._policyHandlers) {
            return this._policyHandlers[metaName];
        }
        return null;
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

    getTargetPolicy(target)
    {
        if (!target) {
            throw new Error('Target Not Provided!')
        }
        if (!target.dn) {
            throw new Error('Target DN Not Set!')
        }
        this.logger.info('[getTargetPolicy] %s...', target.dn)
        this.logger.info('[getTargetPolicy] id: %s...', target.id)
        var naming = [target.dn]
        var policy = this._desiredConfig.find('gcp-policy', naming);
        if (policy) {
            return Promise.resolve(policy);
        }
        policy = this._desiredConfig.section('gcp-policy').create(naming);
        policy.setConfig('kind', target.meta.name);
        policy.setConfig('policy', {});

        return Promise.resolve()
            .then(() => policy.relation(target))
            .then(() => this._setupPolicyTargetDefaults(target, policy))
            .then(() => policy)
    }

    _setupPolicyTargetDefaults(item, policy)
    {
        var policyHandler = this.getPolicyHandler(item.meta.name);
        if (!policyHandler.setupDefault) {
            return;
        }
        return policyHandler.setupDefault(item);
    }

    setupTargetPolicyRole(target, role, member)
    {
        var memberType;
        memberType = 'serviceAccount' // TODO: handle genericly
        return this._setupTargetPolicyRole(target, role, memberType, member.dn, 'relation')
            .then(policy => policy.relation(member));
    }

    setupTargetPolicyRoleId(target, role, memberType, memberId)
    {
        return this._setupTargetPolicyRole(target, role, memberType, memberId, 'id');
    }

    _setupTargetPolicyRole(target, role, memberType, memberId, folder)
    {
        return this.getTargetPolicy(target)
            .then(policy => {
                if (!policy.config.policy[role]) {
                    policy.config.policy[role] = {
                        id: {},
                        relation: {}
                    }
                }
                if (!policy.config.policy[role][folder][memberType]) {
                    policy.config.policy[role][folder][memberType] = {}
                }
                policy.config.policy[role][folder][memberType][memberId] = true;
                return policy;
            });
    }

    getRepository(entity)
    {
        if (entity.id in this._repositories) {
            return this._repositories[entity.id];
        }
        return null;
    }

}

module.exports = NativeProcessor;