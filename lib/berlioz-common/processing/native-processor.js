const Promise = require("the-promise");
const _ = require("the-lodash");
const Path = require("path");
const fs = require("fs");
const yaml = require('js-yaml');
const optionalRequire = require("optional-require")(require);

class NativeProcessor
{
    constructor(logger, helper)
    {
        this._logger = logger;
        this._helper = helper;

        this._scope = {};
        this._items = {};
        this._multiItems = {};
        this._entities = {};
        this._providerPeerConfigHandlers = {};
        this._processedItems = [];
        this._policyHandlers = {};
        this._repositories = {};
        this._itemHandlers = {};
        this._providerHelper = null;

        this._consumers = {};
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
        var itemsDict = _.values(this._items);
        var items = _.keys(itemsDict)
            .map(x => x[""])
            .filter(x => x);
        return items;
    }

    get providerHelper() {
        return this._providerHelper;
    }

    setupScope(scope) {
        this._scope = _.clone(scope);
        this._logger.info('[setupScope] keys: ', _.keys(this._scope))
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

    setupProviderPeerConfigHandler(name, config) {
        this._providerPeerConfigHandlers[name] = config;
    }

    setupCustomHandler(metaName, handler)
    {
        this._itemHandlers[metaName] = handler;
    }

    init()
    {
        this.logger.info("[init] %s...");
        return Promise.resolve()
            .then(() => this._loadPolicyHandlers())
            .then(() => this._setupProviderHelper())
            ;
    }

    constructConfig(config, clusterEntity)
    {
        this.logger.info("[constructConfig] %s...", clusterEntity.id);
        if (!this.providerKind) {
            this.logger.warn("No provider kind set.");
            return;
        }
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
    }

    constructBaseConfig()
    {
        this.logger.info("[constructBaseConfig]...");
        if (!this.providerKind) {
            this.logger.warn("No provider kind set.");
            return;
        }
        return Promise.resolve()
            .then(() => {
                if (!this.providerHelper) {
                    return;
                }
                if (!this.providerHelper.constructConfig) {
                    return;
                }
                return this.providerHelper.constructConfig();
            })
    }

    _setupProviderHelper()
    {
        var pathParts = ['./native-processors',
            this.providerKind,
            'helper'];
        var relPath = pathParts.join('/');
        var HelperClass = optionalRequire(relPath);
        if (!HelperClass) {
            return;
        }
        var handlerArgs = this._makeHandlerArgs(null, null);
        this._providerHelper = new HelperClass(this._logger.sublogger(this.providerKind + "Helper"), handlerArgs);
        return Promise.resolve()
            .then(() => {
                if (this._providerHelper.init) {
                    return this._providerHelper.init();
                }
            })
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

        return this._processHandler(handler, config, "", consumed, {
            consumer: consumer,
            targetEntity: targetEntity,
            providerItem: providerItem,
            consumerItem: consumerItem
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

    setupConsumedRelationsAndPeers(entity, item, options)
    {
        options = options || {};
        var consumerInfo = {
            entity: entity,
            item: item,
            consumed: {}
        };
        this._consumers[item.dn] = consumerInfo;
        
        var consumedMap = this.extractServiceConsumedItems(entity);
        this.logger.info('[setupConsumedRelationsAndPeers] %s, consumedMapKeys: ', entity.id, _.keys(consumedMap));

        return Promise.resolve()
            .then(() => Promise.serial(_.values(consumedMap), x => {
                return this._setupConsumedEntityRelationsAndPeers(x, item, consumerInfo);
            }))
    }

    _setupConsumedEntityRelationsAndPeers(consumedItem, item, consumerInfo)
    {
        this.logger.info('[_setupConsumedEntityRelationsAndPeers] ', consumedItem.info);
        return Promise.resolve()
            .then(() => {
                var namingConfig = {
                    entityId: consumedItem.info.id
                }
                if (consumedItem.item.meta.name != 'gcp-firestore') {
                    namingConfig.propertyTag = 'name';
                }
                consumerInfo.consumed[consumedItem.item.dn] = namingConfig;
            }) 
            .then(() => {
                return Promise.serial(_.values(consumedItem.items), x => {
                    this._setupConsumedRelation(item, x);
                });
            })
            .then(() => {
                if (!consumedItem.consumedItem) {
                    return;
                }
                consumerInfo.consumed[consumedItem.consumedItem.dn] = {
                    entityId: consumedItem.info.id,
                    propertyTag: 'subName'
                }
                return this._setupConsumedRelation(item, consumedItem.consumedItem);
            }) 
        ;
    }

    _setupConsumedRelation(item, consumedItem)
    {
        return item.relation(consumedItem.meta.name, consumedItem.naming)
            .then(rel => rel.markIgnoreDelta());
    }

    produceConsumerConfig(item, allowMissing)
    {
        this.logger.info("[produceConsumerConfig] %s ...", item.dn);

        var consumerInfo = this._consumers[item.dn];
        if (!consumerInfo) {
            this.logger.info("[produceConsumerConfig] NOT PRESENT: %s. Existing consumers in dict:", item.dn, _.keys(this._consumers));
            return {};
        }

        var consumedMap = this.extractServiceConsumedItems(consumerInfo.entity);

        var result = {};
        for(var consumedItemDn of _.keys(consumerInfo.consumed))
        {
            var consumedInfo = consumerInfo.consumed[consumedItemDn];

            this.logger.info("[produceConsumerConfig] %s -> %s ...", item.dn, consumedItemDn);

            var consumedMapItem = consumedMap[consumedInfo.entityId];
            var consumedConfig = {}
            if (consumedMapItem) {
                consumedConfig = _.clone(consumedMapItem.info);
            }

            var targetItem = this._helper._currentConfig.findDn(consumedItemDn);
            if (targetItem && targetItem.id)
            {
                if (consumedInfo.propertyTag) {
                    consumedConfig[consumedInfo.propertyTag] = targetItem.id;
                }

                this.logger.info("[produceConsumerConfig] %s => %s ...", item.dn, targetItem.dn);
                this.logger.info("[produceConsumerConfig] Setting %s, Id = ", item.dn, targetItem.id);
    
                if (targetItem.meta.name == 'gcp-sql')
                {
                    if (item.meta.name == 'gcp-cloud-function') {
                        consumedConfig.config = {
                            socketPath: `/cloudsql/${targetItem.obj.connectionName}`
                        }
                    }
    
                    if (item.meta.name.startsWith('k8s-')) {
                        consumedConfig.config = {
                            host: '127.0.0.1'
                        }
                    }
                }
            }
            else
            {
                if (allowMissing) {
                    consumedConfig.present = false;
                } else {
                    return null;
                }
            }

            result[consumedInfo.entityId] = consumedConfig;
        }
        return result;
    }

    produceConsumerPeers(item, allowMissing)
    {
        var consumerConfig = this.produceConsumerConfig(item, allowMissing);
        if (!consumerConfig) {
            return null;
        }
        var result = {};
        for(var x of _.keys(consumerConfig))
        {
            var consumed = consumerConfig[x];
            result[x] = {
                "0": consumed
            }
        }
        return result;
    }

    produceConsumerMetadata(item, allowMissing)
    {
        var consumerInfo = this._consumers[item.dn];
        var consumerEntity = consumerInfo.entity;
        var consumedMap = this.extractServiceConsumedItems(consumerInfo.entity);

        var consumerConfig = this.produceConsumerConfig(item, allowMissing);
        if (!consumerConfig) {
            return null;
        }

        var result = {};
        for(var consumedInfo of _.values(consumedMap))
        {            
            var consumedEntity = consumedInfo.consumedEntity;
            var targetEntity = this.getEntity(consumedEntity.targetId);

            var consumedConfig = consumerConfig[targetEntity.id];
            if (!consumedConfig) {
                continue;
            }

            if (!result[targetEntity.kind]) {
                result[targetEntity.kind] = {};
            }

            var label = targetEntity.name;
            if (consumerEntity.sectorName != targetEntity.sectorName) {
                label = targetEntity.sectorName + '_' + label;
            }
            result[targetEntity.kind][label] = consumedConfig;
        }
        return result;
    }

    produceMetadataDirStructure(item, allowMissing)
    {
        var fullMetadata = this.produceConsumerMetadata(item, allowMissing);
        if (!fullMetadata) {
            return null;
        }

        var structure = {};

        structure[`all.json`] = JSON.stringify(fullMetadata, null, 4);
        structure[`all.yaml`] = yaml.dump(fullMetadata, {
                indent: 4
            });

        for(var kind of _.keys(fullMetadata))
        {
            for(var id of _.keys(fullMetadata[kind]))
            {
                var metadata = fullMetadata[kind][id];

                structure[`${kind}/${id}.json`] = JSON.stringify(metadata, null, 4);
                structure[`${kind}/${id}.yaml`] = yaml.dump(metadata, {
                        indent: 4
                    });
            }
        }

        return structure;
    }

    _extractConsumed(consumedEntity, result)
    {
        this.logger.info("[_extractConsumed] %s => %s...", consumedEntity.id, consumedEntity.targetId);
        var item = this.getItem(consumedEntity.targetId) 
        var itemsDict = this.getItemFlavorMap(consumedEntity.targetId);
        if (item) {
            var entity = this.getEntity(consumedEntity.targetId);
            var itemConfig = {
                id: entity.id,
                kind: entity.kind,
                class: entity.className,
                subClass: entity.subClassName
            };

            var configHandler = this._providerPeerConfigHandlers[this.providerKind];
            if (configHandler) {
                itemConfig.config = configHandler(item, entity);
            }
            if (!itemConfig.config) {
                itemConfig.config = {};
            }

            var consumedItem = this.getItem(consumedEntity.id);
            result[consumedEntity.targetId] = {
                info: itemConfig,
                entity: entity,
                consumedEntity: consumedEntity,
                item: item,
                items: itemsDict,
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

        return Promise.resolve(this._processHandler(handler, config, "", entity, {}))
            .then(() => {
                var dependentHandler = this._getEntityHandler(entity, 'dependent');
                if (!dependentHandler) {
                    return;
                }
                var item = this.getItem(entity.id);
                return this._processHandler(dependentHandler, config, 'dependent', entity, {
                    ownerItem: item
                })
            });
    }

    _makeHandlerArgs(config, handlerArgs)
    {
        if (!handlerArgs) {
            handlerArgs = {}
        } else {
            handlerArgs = _.clone(handlerArgs);
        }

        handlerArgs.logger = this.logger;
        handlerArgs.processor = this;
        handlerArgs.config = config;
        handlerArgs.scope = this._scope;
        if (this._helper) {
            handlerArgs.helper = this._helper;
        } else {
            handlerArgs.helper = null;
        }
        if (this.providerHelper) {
            handlerArgs.providerHelper = this.providerHelper;
        } else {
            handlerArgs.providerHelper = null;
        }
        return handlerArgs;
    }

    _processHandler(handler, config, flavor, entity, handlerArgs)
    {
        this.logger.info("[_processHandler] Running handler for %s :: %s...", flavor, entity.id);

        handlerArgs = this._makeHandlerArgs(config, handlerArgs);
        handlerArgs.entity = entity;

        if (handler.checkSkip)
        {
            if (!handler.checkSkip(handlerArgs))
            {
                return;
            }
        }

        return Promise.resolve()
            .then(() => {
                if (handler.customCreate) {
                    return handler.customCreate(handlerArgs)
                        .then(item => {
                            if (!item) {
                                throw new Error("NativeProcessor. No item returned from custom-processor for " + entity.id);
                            }
                            return item;
                        });
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
                    }
                    return item;
                }

            })
            .then(item => {
                handlerArgs.item = item; 

                this._reportNewItem(entity, item, flavor);

                this._processedItems.push({
                    handler: handler,
                    args: handlerArgs
                })
            })
            .then(() => {
                if(handler.setupItem) {
                    return handler.setupItem(handlerArgs)
                }
            })
            .then(() => {
                var customHandler = this._itemHandlers[handlerArgs.item.meta.name];
                if (customHandler) {
                    return customHandler(handlerArgs);
                }
            })
            .then(() => null);
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

    _getProviderInitHandler()
    {
        var pathParts = ['./native-processors',
            this.providerKind,
            'init'];
        var relPath = pathParts.join('/');
        var handler = optionalRequire(relPath);
        if (!handler) {
            return null;
        }
        return handler;
    }

    _loadPolicyHandlers()
    {
        var pathParts = [__dirname,
            'policy-handlers',
            this.providerKind];
        var dirPath = Path.join.apply(null, pathParts);
        this.logger.info("[_loadPolicyHandlers] loading from %s...", dirPath);
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

    _reportNewItem(entity, item, flavor)
    {
        if (!entity) {
            throw new Error("Entity not set.");
        }
        if (!item) {
            throw new Error("Item not set.");
        }
        this.logger.info("[_reportNewItem] created %s :: %s for %s...", flavor, item.dn, entity.id);
        if (!this._items[entity.id]) {
            this._items[entity.id] = {};
        }
        this._items[entity.id][flavor] = item;
        this._entities[entity.id] = entity;
    }

    getItem(entityId, flavor) 
    {
        var itemDict = this._items[entityId];
        if (!itemDict) {
            return null;
        }
        if (!flavor) {
            flavor = "";
        }
        var item = itemDict[flavor];
        if (!item) {
            return null;
        }
        return item;
    }

    getItemFlavorMap(entityId) 
    {
        var itemDict = this._items[entityId];
        if (!itemDict) {
            return {};
        }
        return itemDict;
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
            .then(() => this._setupPolicyTargetDefaults(target))
            .then(() => policy)
    }

    _setupPolicyTargetDefaults(item)
    {
        var policyHandler = this.getPolicyHandler(item.meta.name);
        if (!policyHandler) {
            throw new Error(`[_setupPolicyTargetDefaults] No policy handler for ${item.meta.name}`)
        }
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

    debugWriteConfig()
    {
        return Promise.resolve()
            .then(() => this._debugWriteItems())
            .then(() => this._debugWriteConsumedItems())
            .then(() => this._debugWriteConsumers())
            .then(() => this._debugWriteConsumerMetadata())
            .then(() => this._debugWriteConsumerDirStructure())
            ;
    }

    _debugWriteItems()
    {
        return this._helper.debugWriteToFile('native-processor-items', writer => {
            for(var entityId of _.keys(this._items)) {
                writer.write('* ' + entityId);
                writer.indent();

                var itemDict = this._items[entityId];

                for(var flavor of _.keys(itemDict))
                {
                    writer.write(':: ' + flavor);
                    writer.indent();

                    var item = itemDict[flavor];

                    writer.write('Dn: ' + item.dn);
                    writer.write('Id: ' + JSON.stringify(item.id));
    
                    writer.unindent();
                }

                writer.unindent();

                writer.write();
                writer.write();
            }
        });
    }

    _debugWriteConsumedItems()
    {
        if (!this._helper.clusterEntity) {
            return;
        }
        return this._helper.debugWriteToFile('native-processor-consumed-items', writer => {

            for(var service of this._helper.clusterEntity.services)
            {
                this._debugWriteEntityConsumedItems(service, writer);
            }

            for(var lambda of this._helper.clusterEntity.lambdas)
            {
                this._debugWriteEntityConsumedItems(lambda, writer);
            }
        });
    }

    _debugWriteEntityConsumedItems(entity, writer)
    {
        writer.write('* ' + entity.id);

        var consumedMap = this.extractServiceConsumedItems(entity);

        for(var x of _.keys(consumedMap))
        {
            writer.indent();
            writer.write('-> ' + x);
            writer.indent();

            var consumedInfo = consumedMap[x];

            if (consumedInfo.entity) {
                consumedInfo.entity = `[Entity ${consumedInfo.entity.id}]`;
            }
            if (consumedInfo.consumedEntity) {
                consumedInfo.consumedEntity = `[Entity ${consumedInfo.consumedEntity.id}]`;
            }
            if (consumedInfo.item) {
                consumedInfo.item = `[Item ${consumedInfo.item.dn}]`;
            }
            if (consumedInfo.consumedItem) {
                consumedInfo.consumedItem = `[Item ${consumedInfo.consumedItem.dn}]`;
            }

            consumedInfo.items = _.clone(consumedInfo.items);
            for(var flavor of _.keys(consumedInfo.items))
            {
                consumedInfo.items[flavor] = `[Item ${consumedInfo.items[flavor].dn}]`;
            }

            writer.write(consumedInfo);

            writer.unindent();
            writer.unindent();
        }

        writer.write();
        writer.write();
    }

    _debugWriteConsumers()
    {
        return this._helper.debugWriteToFile('native-processor-consumers', writer => {

            for(var key of _.keys(this._consumers))
            {
                writer.write('* ' + key);
                writer.indent();

                var consumerItemInfo = this._consumers[key];
                writer.write('Entity Id: ' + JSON.stringify(consumerItemInfo.entity.id));
                writer.write('Item Dn: ' + JSON.stringify(consumerItemInfo.item.dn));
                writer.write('Item Id: ' + JSON.stringify(consumerItemInfo.item.id));

                writer.write('Consumed Links: ');
                writer.write(consumerItemInfo.consumed);

                writer.write('Consumer Config: ');
                writer.write(this.produceConsumerConfig(consumerItemInfo.item, true));
            
                writer.write('Consumer Peers: ');
                writer.write(this.produceConsumerPeers(consumerItemInfo.item, true));
                
                writer.unindent();
                writer.write();
                writer.write();
            }

        });
    }

    _debugWriteConsumerMetadata()
    {
        return this._helper.debugWriteToFile('native-processor-consumer-metadata', writer => {

            for(var key of _.keys(this._consumers))
            {
                writer.write('* ' + key);
                writer.indent();

                var consumerItemInfo = this._consumers[key];
                writer.write('Entity Id: ' + JSON.stringify(consumerItemInfo.entity.id));
                writer.write('Item Dn: ' + JSON.stringify(consumerItemInfo.item.dn));
                writer.write('Item Id: ' + JSON.stringify(consumerItemInfo.item.id));

                writer.write('Consumer Metadata: ');
                writer.write(this.produceConsumerMetadata(consumerItemInfo.item, true));
                
                writer.unindent();
                writer.write();
                writer.write();
            }

        });
    }
    
    _debugWriteConsumerDirStructure()
    {
        return this._helper.debugWriteToFile('native-processor-consumer-dir-structure', writer => {

            for(var key of _.keys(this._consumers))
            {
                writer.write('* ' + key);
                writer.indent();

                var consumerItemInfo = this._consumers[key];
                writer.write('Entity Id: ' + JSON.stringify(consumerItemInfo.entity.id));
                writer.write('Item Dn: ' + JSON.stringify(consumerItemInfo.item.dn));
                writer.write('Item Id: ' + JSON.stringify(consumerItemInfo.item.id));

                writer.write('Directory Structure: ');
                writer.write(this.produceMetadataDirStructure(consumerItemInfo.item, true));
                
                writer.unindent();
                writer.write();
                writer.write();
            }

        });
    }


}

module.exports = NativeProcessor;