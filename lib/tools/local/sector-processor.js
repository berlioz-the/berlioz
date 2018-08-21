const Promise = require('the-promise');
const _ = require('the-lodash');
const uuid = require('uuid/v4');
const keypair = require('keypair');

const DependencyResolver = require('processing-tools/dependency-resolver');
const SubnetAllocator = require('processing-tools/subnet-allocator');
const PortAllocator = require('processing-tools/port-allocator');

const ServiceProcessor = require('./service-processor');

class SectorProcessor
{
    constructor(clusterProcessor, sectorEntity)
    {
        this._sectorEntity = sectorEntity;
        this._clusterProcessor = clusterProcessor;
        this._rootProcessor = clusterProcessor.rootProcessor;
        this._logger = clusterProcessor.logger;
        this._serviceProcessors = {};

        for (var serviceEntity of this.sectorEntity.services)
        {
            var svc = new ServiceProcessor(this, serviceEntity);
            this._serviceProcessors[serviceEntity.name] = svc;
        }
    }

    get logger() {
        return this._logger;
    }

    get clusterEntity() {
        return this.clusterProcessor.clusterEntity;
    }

    get sectorEntity() {
        return this._sectorEntity;
    }

    get sectorName() {
        return this.sectorEntity.name;
    }

    get clusterName() {
        return this.clusterEntity.name;
    }

    get serviceProcessors() {
        return _.values(this._serviceProcessors);
    }
    
    get rootProcessor() {
        return this._rootProcessor;
    }

    get clusterProcessor() {
        return this._clusterProcessor;
    }

    get currentConfig() {
        return this.rootProcessor._currentConfig;
    }

    get deploymentName() {
        return this.rootProcessor.deploymentName;
    }

    getServiceProcessor(name) {
        return this._serviceProcessors[name];
    }

    finalizeSetup()
    {
        return Promise.serial(this.serviceProcessors, x => x.finalizeSetup());
    }

    constructConfig(config)
    {
        this._logger.info('[sector::constructConfig] %s', this.sectorEntity.id);
        return Promise.resolve()
            // .then(() => this._constructZipkin(config))
            .then(() => this._constructEncryptionKeys(config))
            // .then(() => this._constructSecrets(config))
            // .then(() => this._constructDatabases(config))
            // .then(() => this._constructQueues(config))
            .then(() => this._constructSidecars(config))
            .then(() => this._constructServices(config))
            .then(() => this._setupConfigTaskDependencies(config))
            ;
    }

    preConstructInit()
    {
        this._preparePortAllocator();
        for(var serviceProcessor of this.serviceProcessors)
        {
            serviceProcessor.preConstructInit();
        }
    }

    _preparePortAllocator()
    {

    }

    _constructDatabases(config)
    {
        return Promise.serial(this.clusterEntity.databases, x => this.getDatabase(config, x));
    }

    getDatabase(config, database)
    {
        if (database.className == 'nosql') {
            return this._constructDynamoDBDatabase(config, database);
        }
    }

    _constructDynamoDBDatabase(config, database)
    {
        var naming = [this.deploymentName, this.clusterName, this.sectorName, database.name];
        var db = config.find('dynamodb', naming);
        if (db) {
            return db;
        }
        db = config.section('dynamodb').create(naming);
        db.config.AttributeDefinitions = {};
        db.config.KeySchema = {};
        for(var attribute of database.attributes)
        {
            db.config.AttributeDefinitions[attribute.name] = {
                AttributeType: _.upperCase(attribute.type.substring(0, 1))
            };
            if (attribute.keyType == 'hash' || attribute.keyType == 'range')
            {
                db.config.KeySchema[attribute.name] = {
                    KeyType: _.upperCase(attribute.keyType)
                };
            }
        }
        return db;
    }

    _constructEncryptionKeys(config)
    {
        this._logger.info('[sector::_constructEncryptionKeys] ');
        return this.getEncryptionKeyAlias(config)
    }

    getEncryptionKeyAlias(config)
    {
        this._logger.info('[sector::getEncryptionKeyAlias] ...');

        var aliasNaming = [this.deploymentName, this.clusterName, this.sectorName];
        var keyAliasItem = config.find('encryption-key-alias', aliasNaming);
        if (keyAliasItem) {
            return keyAliasItem;
        }
        keyAliasItem = config.section('encryption-key-alias').create(aliasNaming)

        var keyNaming = [this.deploymentName, this.clusterName, this.sectorName];
        var keyItem = config.section('encryption-key').create(keyNaming);
        keyItem.setConfig('KeyState', 'Enabled')

        return Promise.resolve()
            .then(() => keyAliasItem.relation(keyItem))
            .then(() => keyAliasItem);
    }

    _constructSecrets(config)
    {
        this._logger.info('[cluster::_constructSecrets] ');
        return Promise.serial(this.clusterEntity.secrets, x => this.getSecret(config, x));
    }

    getSecret(config, secret)
    {
        if (!secret) {
            return null;
        }
        this._logger.info('[cluster::getSecret] %s...', secret.name);
        if (secret.className == 'public-key' && secret.subClassName == 'rsa') {
            return this._constructRsaSecret(config, secret);
        }
    }

    getSecretForAction(config, secret, action)
    {
        this._logger.info('[cluster::getSecretForAction] %s :: %s...', secret.id, action);

        return Promise.resolve(this.getSecret(config, secret))
            .then(result => {
                if (!result) {
                    this._logger.warn('[cluster::getSecretForAction] no result for %s :: %s...', secret.id, action);
                    return null;
                }
                this._logger.warn('[cluster::getSecretForAction] %s :: %s, results:', secret.id, action, _.keys(result));

                if (action in result) {
                    return result[action];
                }
                return null;
            })
    }

    _constructRsaSecret(config, secret)
    {
        this._logger.info('[cluster::_constructRsaSecret] %s...', secret.name);

        var namingPublic = [this.deploymentName, this.clusterName, this.sectorName, secret.name, 'secret_public_key'];
        var namingPrivate = [this.deploymentName, this.clusterName, this.sectorName, secret.name, 'secret_private_key'];

        var secretPublicItem = config.find('parameter', namingPublic);
        var secretPrivateItem = config.find('parameter', namingPrivate);

        return Promise.resolve()
            .then(() => {
                if (!secretPublicItem || !secretPrivateItem) {
                    secretPublicItem = config.section('parameter').create(namingPublic);
                    secretPublicItem.setConfig('Type', 'SecureString');

                    secretPrivateItem = config.section('parameter').create(namingPrivate);
                    secretPrivateItem.setConfig('Type', 'SecureString');

                    var pair = keypair(secret.length);
                    secretPublicItem.setRuntime({
                        Value: pair.public
                    })
                    secretPrivateItem.setRuntime({
                        Value: pair.private
                    })
                }
                return Promise.resolve()
                    .then(() => this.getEncryptionKeyAlias(config))
                    .then(keyAlias => {
                        return Promise.resolve()
                            .then(() => secretPublicItem.relation(keyAlias))
                            .then(() => secretPrivateItem.relation(keyAlias))
                    })
            })
            .then(() => ({
                public: secretPublicItem,
                private: secretPrivateItem,
                encrypt: secretPublicItem,
                decrypt: secretPrivateItem
            }))
    }

    _massageKeyAliases(config)
    {
        var keyMap = {}
        for(var key of config.section('encryption-key').items)
        {
            keyMap[key.id] = key
        }

        return Promise.serial(config.section('encryption-key-alias').items, alias => {
            var keyId = alias.obj.TargetKeyId;
            var key = keyMap[keyId];
            if (key) {
                return alias.relation(key);
            } else {
                key.remove();
            }
        })
    }

    _constructQueues(config)
    {
        this._logger.info('[cluster::_constructQueues] ');
        return Promise.serial(this.clusterEntity.queues, x => this.getQueue(config, x));
    }

    getQueue(config, queue)
    {
        if (!queue) {
            return null;
        }
        this._logger.info('[cluster::getQueue] %s...', queue.name);
        if (queue.className == 'queue' && queue.subClassName == 'kinesis') {
            return this._constructKinesisQueue(config, queue);
        }
    }

    _constructKinesisQueue(config, queue)
    {
        this._logger.info('[cluster::_constructKinesisQueue] %s...', queue.name);

        var naming = [this.deploymentName, this.clusterName, this.sectorName, queue.name];
        var queueItem = config.find('kinesis', naming);
        if (queueItem) {
            return queueItem;
        }
        queueItem = config.section('kinesis').create(naming);
        return queueItem;
    }

    _constructSidecars(config)
    {
        this._logger.info('[sector::_constructSidecars] %s', this.sectorName);
        var services = this.sectorEntity.services.filter(x => x.sidecar == 'instance');
        return Promise.serial(services, service => {
            var serviceProcessor = this.getServiceProcessor(service.name);
            return serviceProcessor.constructConfig(config);
        });
    }

    _constructServices(config)
    {
        var resolver = new DependencyResolver();
        for (var serviceEntity of this.sectorEntity.services)
        {
            if (serviceEntity.sidecar) {
                continue;
            }
            this._logger.info('[sector::_constructServices] service: %s', serviceEntity.name);
            resolver.add(serviceEntity.name);
            for (var consumerEntity of serviceEntity.localConsumes)
            {
                resolver.add(serviceEntity.name, consumerEntity.targetNaming[1]);
            }
        }
        this._logger.info('[sector::_constructServices] service order: ', resolver.order );
        return Promise.serial(resolver.order, name => {
            this._logger.info('[sector::_constructServices] 2. service: %s', name);
            var serviceProcessor = this.getServiceProcessor(name);
            return serviceProcessor.constructConfig(config);
        });
    }

    _setupConfigTaskDependencies(config)
    {
        this._logger.info('[_setupConfigTaskDependencies]');
        return Promise.serial(_.values(this._serviceProcessors), x => x.setupTasksDependencies(config));
    }

    markNewStageNeeded(reason)
    {
        return this.rootProcessor.markNewStageNeeded(reason);
    }

    _getZipkinNaming()
    {
        return [this.name, 'zipkin', 0];;
    }

    getZipkinTask(config)
    {
        var naming = this._getZipkinNaming();
        var task = config.find('task', naming);
        return task;
    }

    _constructZipkin(config)
    {
        var naming = this._getZipkinNaming();
        var task = config.find('task', naming);
        if (!task) {
            task = config.section('task').create(naming);
            task.setConfig('taskId', uuid());
        }
        task.setConfig('isNative', true);
        task.setConfig('isZipkin', true);

        var repoInfo = this.rootProcessor.getHelperImage('zipkin');
        task.setConfig('image', repoInfo.name);
        task.setConfig('imageId', repoInfo.digest);

        task.setConfig('labels', {
            'berlioz:kind': 'task',
            'berlioz:cluster': naming[0],
            'berlioz:service': naming[1],
            'berlioz:identity': naming[2].toString(),
            'berlioz:zipkin': 'true',
            'berlioz:native': 'true'
        });

        task.setConfig('environment', {
            'BERLIOZ_TASK_ID': task.config.taskId,
            'BERLIOZ_INFRA': 'local',
            'BERLIOZ_REGION': 'local',
            'BERLIOZ_AWS_CLUSTER': 'local',
            'BERLIOZ_INSTANCE_ID': 'local'
        });

        task.config.ports = { tcp: {}, udp: {}};
        var hostPort = this.rootProcessor.fetchTaskHostPort(task.dn, 'tcp', this.rootProcessor.getBerliozZipkinPort());
        task.config.ports['tcp'][this.rootProcessor.getBerliozZipkinPort()] = hostPort;

        return Promise.resolve()
            .then(() => this._setupReadyContainerObject(config, task))
            .then(() => task);
    }

    _setupReadyContainerObject(config, item)
    {
        var readyObject = config.section('ready-' + item.meta.name).create(item.naming);
        readyObject.setConfig('naming', item.naming);
        return Promise.resolve()
            .then(() => readyObject.relation(item))
            .then(() => readyObject)
            ;
    }
}

module.exports = SectorProcessor;
