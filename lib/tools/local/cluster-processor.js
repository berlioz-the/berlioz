const Promise = require('the-promise');
const _ = require('the-lodash');
const uuid = require('uuid/v4');
const keypair = require('keypair');

const DependencyResolver = require('processing-tools/dependency-resolver');
const SubnetAllocator = require('processing-tools/subnet-allocator');
const PortAllocator = require('processing-tools/port-allocator');

const ServiceProcessor = require('./service-processor');

class ClusterProcessor
{
    constructor(rootProcessor, logger, clusterEntity)
    {
        this._rootProcessor = rootProcessor;
        this._logger = logger;
        this._clusterEntity = clusterEntity;
        this._serviceProcessors = {};

        for (var serviceEntity of this.clusterEntity.services)
        {
            var svc = new ServiceProcessor(this, serviceEntity);
            this._serviceProcessors[svc.name] = svc;
        }
    }

    get logger() {
        return this._logger;
    }

    get clusterEntity() {
        return this._clusterEntity;
    }

    get name() {
        return this.clusterEntity.name;
    }

    get serviceProcessors() {
        return _.values(this._serviceProcessors);
    }

    get rootProcessor() {
        return this._rootProcessor;
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

    extractTasksToClone(config, tasksToClone)
    {
        for(var task of config.section('task').items)
        {
            if (task.config.isNative)
            {
                tasksToClone.push(task);
            }
            else
            {
                var serviceName = task.config.labels["berlioz:service"];
                if (serviceName in this._serviceProcessors) {
                    tasksToClone.push(task);
                }
            }
        }
    }

    constructConfig(config)
    {
        this._logger.info('[cluster::constructConfig] %s', this.name);
        return Promise.resolve()
            .then(() => this.preConstructInit())
            .then(() => this._constructBerliozAgent(config))
            .then(() => this._constructZipkin(config))
            .then(() => this._constructEncryptionKeys(config))
            .then(() => this._constructSecrets(config))
            .then(() => this._constructDatabases(config))
            .then(() => this._constructQueues(config))
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
        var naming = [this.deploymentName, this.name, database.name];
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
        this._logger.info('[cluster::_constructEncryptionKeys] ');
        return this.getEncryptionKeyAlias(config)
    }

    getEncryptionKeyAlias(config)
    {
        this._logger.info('[cluster::getEncryptionKeyAlias] ...');

        var aliasNaming = ['alias/' + this.deploymentName + '/' + this.name];
        var keyAliasItem = config.find('encryption-key-alias', aliasNaming);
        if (keyAliasItem) {
            return keyAliasItem;
        }
        keyAliasItem = config.section('encryption-key-alias').create(aliasNaming)

        var keyNaming = [this.deploymentName, this.name];
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

    _constructRsaSecret(config, secret)
    {
        this._logger.info('[cluster::_constructRsaSecret] %s...', secret.name);

        var namingPublic = ['/' + this.deploymentName + '/' + this.name + '/' + secret.name + '/public'];
        var secretPublicItem = config.find('parameter', namingPublic);
        if (secretPublicItem) {
            return secretPublicItem;
        }
        secretPublicItem = config.section('parameter').create(namingPublic);
        secretPublicItem.setConfig('Type', 'SecureString');

        var namingPrivate = ['/' + this.deploymentName + '/' + this.name + '/' + secret.name + '/private'];
        var secretPrivateItem = config.section('parameter').create(namingPrivate);
        secretPrivateItem.setConfig('Type', 'SecureString');

        var pair = keypair(secret.length);
        secretPublicItem.setRuntime({
            Value: pair.public
        })
        secretPrivateItem.setRuntime({
            Value: pair.private
        })

        return Promise.resolve()
            .then(() => this.getEncryptionKeyAlias(config))
            .then(keyAlias => {
                return Promise.resolve()
                    .then(() => secretPublicItem.relation(keyAlias))
                    .then(() => secretPrivateItem.relation(keyAlias))
            })
            .then(() => secretPublicItem)
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

        var naming = [this.deploymentName, this.name, queue.name];
        var queueItem = config.find('kinesis', naming);
        if (queueItem) {
            return queueItem;
        }
        queueItem = config.section('kinesis').create(naming);
        return queueItem;
    }

    _constructServices(config)
    {
        var resolver = new DependencyResolver();
        for (var serviceEntity of this.clusterEntity.services)
        {
            this._logger.info('[_constructServices] service: %s', serviceEntity.name);
            resolver.add(serviceEntity.name);
            for (var consumerEntity of serviceEntity.localConsumes)
            {
                resolver.add(serviceEntity.name, consumerEntity.targetNaming[1]);
            }
        }
        this._logger.info('[_constructServices] service order: ', resolver.order );
        return Promise.serial(resolver.order, name => {
            this._logger.info('[_constructServices] 2. service: %s', name);
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

    _getBerliozAgentNaming()
    {
        return [this.name, 'berlioz-agent', 0];
    }

    getBerliozAgentTask(config)
    {
        var naming = this._getBerliozAgentNaming();
        var task = config.find('task', naming);
        return task;
    }

    _constructBerliozAgent(config)
    {
        var naming = this._getBerliozAgentNaming();
        var task = config.find('task', naming);
        if (!task) {
            task = config.section('task').create(naming);
            task.setConfig('taskId', uuid());
        }
        task.setConfig('isNative', true);
        task.setConfig('isAgent', true);

        var repoInfo = this._getImage('berlioz/agent');
        task.setConfig('image', repoInfo.image);
        task.setConfig('imageId', repoInfo.digest);

        task.setConfig('labels', {
            'berlioz:kind': 'task',
            'berlioz:cluster': naming[0],
            'berlioz:service': naming[1],
            'berlioz:identity': naming[2].toString(),
            'berlioz:agent': 'true',
            'berlioz:native': 'true'
        });

        task.setConfig('environment', {
            'BERLIOZ_TASK_ID': task.config.taskId,
            'BERLIOZ_INFRA': 'local',
            'BERLIOZ_REGION': 'local',
            'BERLIOZ_CLUSTER': 'local',
            'BERLIOZ_INSTANCE_ID': 'local',
            'BERLIOZ_MESSAGE_QUEUE_BERLIOZ_AGENT': ''
        });

        task.config.ports = { tcp: {}, udp: {}};
        var hostPort = this.rootProcessor.fetchTaskHostPort(task.dn, 'tcp', this.rootProcessor.getBerliozAgentPort());
        task.config.ports['tcp'][this.rootProcessor.getBerliozAgentPort()] = hostPort;

        return Promise.resolve()
            .then(() => this._setupReadyContainerObject(config, task))
            .then(() => task);
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

        var repoInfo = this._getImage('berlioz/zipkin');
        task.setConfig('image', repoInfo.image);
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

    _getImage(name)
    {
        return this.rootProcessor._repositories[name];
    }

}

module.exports = ClusterProcessor;
