const Promise = require('the-promise');
const _ = require('the-lodash');
const Path = require('path');
const uuid = require('uuid/v4');

const EnvTools = require('processing-tools/env-tools');

class ServiceProcessor
{
    constructor(sectorProcessor, serviceEntity)
    {
        this._sectorProcessor = sectorProcessor;
        this._clusterProcessor = sectorProcessor.clusterProcessor;
        this._logger = this.sectorProcessor.logger;
        this._serviceEntity = serviceEntity;
        this._volumes = [];
    }

    get repoStore() {
        return this.rootProcessor.repoStore;
    }

    get serviceEntity() {
        return this._serviceEntity;
    }

    get definition() {
        return this.serviceEntity.definition;
    }

    get serviceName() {
        return this.serviceEntity.name;
    }

    get full_name() {
        return this.clusterName + '-' + this.serviceName;
    }

    get volumes() {
        return this._volumes;
    }

    get clusterProcessor() {
        return this._clusterProcessor;
    }

    get sectorProcessor() {
        return this._sectorProcessor;
    }

    get rootProcessor() {
        return this.sectorProcessor.rootProcessor;
    }

    get clusterName() {
        return this.serviceEntity.clusterName;
    }
    
    get sectorName() {
        return this.serviceEntity.sectorName;
    }

    get desiredCount() {
        if (this.serviceEntity.sidecar == 'instance') {
            return 1;
        }

        var desired = 1;
        var policy = this.serviceEntity.resolvePolicy('scale');
        this._logger.info('DesiredCount CHECK. %s, policy:', this.serviceEntity.id, policy);
        if (_.isNullOrUndefined(policy.config) || _.isNullOrUndefined(policy.config.desired)) {
            desired = 1;
        } else {
            desired = policy.config.desired;
        }

        if (this.definition.scale) {
            if (_.isNumber(this.definition.scale.min)) {
                if (desired < this.definition.scale.min) {
                    desired = this.definition.scale.min;
                }
            }
        }

        return desired;
    }

    get provides() {
        return _.values(this._provides);
    }

    get memory() {
        var value = this.getResource('memory').min;
        if (!value)
        {
            value = this.getResource('memory').max;
        }
        return value;
    }

    get ignition() {
        if (!this.definition.ignition) {
            return {};
        }
        return this.definition.ignition;
    }

    get identity() {
        return this.serviceEntity.identity;
    }

    finalizeSetup()
    {
        if (!this.serviceEntity.isManaged) {
            return;
        }

        this._massageVolumeConfig();
    }

    preConstructInit()
    {
        this._massageProvidesConfig();
    }

    constructConfig(config)
    {
        this._logger.info('[service::constructConfig] %s', this.serviceEntity.id);

        if (!this.serviceEntity.isManaged) {
            return;
        }

        if (!this._getMyImage()) {
            this._logger.error('[service::constructConfig] repository not present for %s.', this.serviceEntity.id);
            return;
        }

        return Promise.resolve()
            .then(() => this._processLoadBalancers(config))
            .then(() => this._processTasks(config))
            ;
    }

    _processLoadBalancers(config)
    {
        var loadBalancedProvides = this.provides.filter(x => x.loadBalance);
        return Promise.serial(loadBalancedProvides, x => this._getLoadBalancer(config, x));
    }

    _getLoadBalancer(config, provided)
    {
        var naming = [this.clusterName, this.sectorName, this.serviceName, provided.name];
        var lb = config.find('load-balancer', naming);
        if (lb) {
            return lb;
        }
        var repoInfo = this.rootProcessor.getHelperImage('load-balancer');
        if (!repoInfo) {
            this._logger.error('Repo for load balancer not present.')
            return null;
        }

        lb = config.section('load-balancer').create(naming);

        if (lb.resolved)  {
            lb.config.ipAddress = lb.resolved.config.ipAddress;
        } else {
            lb.config.ipAddress = this.rootProcessor.allocateContainerAddress();
        }
        lb.config.haProxyConfigPath = Path.resolve(this.rootProcessor.getLoadBalancerWorkingPath(this.serviceEntity, provided.name), 'haproxy.cfg');

        lb.config.image = repoInfo.name;
        lb.config.imageId = repoInfo.digest;

        lb.config.labels = {
            'berlioz:kind': 'load-balancer',
            'berlioz:cluster': this.clusterName,
            'berlioz:sector': this.sectorName,
            'berlioz:service': this.serviceName,
            'berlioz:endpoint': provided.name,
            'berlioz:haproxycfg': lb.config.haProxyConfigPath
        }

        var port = provided.port;
        if (provided.protocol == 'http' || provided.protocol == 'https')
        {
            port = 80;
        }

        var hostPort = this._getContainerEndPointHostPort(lb, provided.networkProtocol, port);
        lb.config.ports = { tcp: {}, udp: {}};
        lb.config.ports[provided.networkProtocol][port] = String(hostPort);

        return Promise.resolve()
            .then(() => this.clusterProcessor._setupReadyContainerObject(config, lb))
            .then(() => lb);
    }

    _processTasks(config)
    {
        return Promise.resolve()
            .then(() => this._deleteExtraTasks(config))
            .then(() => {
                var myTasks = this._getMyTasks(config);
                this._logger.info('[_processTasks] ExistingTasks:', myTasks.map(x => x.dn));
                this._logger.info('[_processTasks] Service=%s. Processing Current Tasks. length=%s', this.full_name, myTasks.length);
                return Promise.serial(myTasks, x => this._configExistingTask(config, x));
            })
            .then(() => this._processNewTasks(config))
            // .then(() => {
            //     var myTasks = this._getMyTasks(config);
            //     return Promise.serial(myTasks, x => this._setupTaskCompletionChecker(config, x));
            // });
    }

    _deleteExtraTasks(config)
    {
        var myTasks = this._getMyTasks(config);
        this._logger.info('[_deleteExtraTasks] %s. myTasks Count: %s', this.full_name, myTasks.length);

        var desiredCount = this.desiredCount;
        this._logger.info('[_deleteExtraTasks] %s. desiredCount: %s', this.full_name, desiredCount);

        var toBeRemovedCount = myTasks.length - desiredCount;

        this._logger.info('[_deleteExtraTasks] %s. toBeRemovedCount: %s', this.full_name, toBeRemovedCount);
        if (toBeRemovedCount <= 0) {
            return;
        }
        myTasks = _.sortBy(myTasks, x => x.id);

        var toBeDeletedTasks = _.takeRight(myTasks, toBeRemovedCount);
        this._logger.info('[_deleteExtraTasks] %s. toBeDeletedTasks: ', this.full_name, toBeDeletedTasks.map(x => x.dn));

        for(var task of toBeDeletedTasks)
        {
            task.remove();
        }
    }

    _setupTaskCompletionChecker(config, task)
    {
        // if (!this.ignition.period) {
        //     return true;
        // }
        //
        // task.completionCheckerCb = () => {
        //     if (task.obj && task.obj.startedAt) {
        //         var diff = new DateDiff(Date.now(), task.obj.startedAt);
        //         this._logger.info('[_setupTaskCompletionChecker] %s, seconds %s past start...', task.dn, diff.seconds());
        //         var secondsToWait = this.ignition.period - diff.seconds();
        //         this._logger.info('[_setupTaskCompletionChecker] %s, %s seconds to wait...', task.dn, secondsToWait);
        //         if (secondsToWait <= 0) {
        //             return {
        //                 ready: true
        //             };
        //         } else if (secondsToWait < 10) {
        //             return {
        //                 ready: false,
        //                 retry: true,
        //                 timeout: secondsToWait
        //             };
        //         } else {
        //             this.rootProcessor.postponeWithTimeout(secondsToWait, 'TaskCompletionCheck: ' + task.dn);
        //             return {
        //                 ready: false,
        //                 retry: false
        //             };
        //         }
        //     }
        //
        //     return {
        //         ready: false,
        //         retry: true,
        //         timeout: 10
        //     };
        // };
    }

    _processNewTasks(config)
    {
        var myTasks = this._getMyTasks(config);
        this._logger.info('[_processNewTasks] Service=%s. MyTasks::Length=%s, DesiredCount=%s', this.serviceEntity.id, myTasks.length, this.desiredCount);
        var toBeCreatedCount = Math.max(this.desiredCount - myTasks.length, 0);
        this._logger.info('[_processNewTasks] Service=%s. toBeCreatedCount=%s', this.serviceEntity.id, toBeCreatedCount);

        var identities = [];
        if (this.identity == 'sequential') {
            identities = _.range(1, this.desiredCount + 1);
        } else {
            var nextIdentity = this._calculateNextIdentity(config);
            this._logger.info('[_processNewTasks] Service=%s. nextIdentity=%s', this.serviceEntity.id, nextIdentity);
            identities = _.range(nextIdentity, toBeCreatedCount + nextIdentity);
        }
        return Promise.serial(identities, identity => {
            this._logger.info('[_processNewTasks] Service=%s. identity=%s', this.serviceEntity.id, identity);
            var task = config.find('task', [this.clusterName, this.sectorName, this.serviceName, identity]);
            if (!task) {
                return this._createNewTask(config, identity);
            } else {
                this._logger.info('[_processNewTasks] Service=%s. identity=%s task already exists.', this.serviceEntity.id, identity);
            }
        });
    }

    _createNewTask(config, identity)
    {
        this._logger.info('[_createNewTask] Creating %s-%s task...', this.serviceEntity.id, identity);

        var task = config.section('task').create([this.clusterName, this.sectorName, this.serviceName, identity]);
        task.setConfig('taskId', uuid());
        task.setConfig('ipAddress', this.rootProcessor.allocateContainerAddress());

        return Promise.resolve()
            .then(() => this._configTask(config, task))
            ;
    }

    _getContainerEndPointHostPort(item, protocol, port)
    {
        var hostPort = this.rootProcessor.fetchTaskHostPort(item.dn, protocol, port);
        return hostPort;
    }

    _configExistingTask(config, task)
    {
        this._logger.info('[_configExistingTask] %s..', task.dn);

        return this._configTask(config, task)
    }

    _getMyImage()
    {
        return this.rootProcessor.getImage(this.serviceEntity.id);
    }

    _configTask(config, task)
    {
        this._logger.info('[_configTask] %s..', task.dn);

        task.setConfig('isNative', false);
        task.setConfig('isAgent', false);
        task.setConfig('isZipkin', false);
        task.setConfig('binds', []);

        task.config.ports = { tcp: {}, udp: {}};
        task.config.labels = {
            'berlioz:kind': 'task',
            'berlioz:cluster': task.naming[0],
            'berlioz:sector': task.naming[1],
            'berlioz:service': task.naming[2],
            'berlioz:identity': task.naming[3].toString()
        }
        
        var repoInfo = this._getMyImage();
        task.config.image = repoInfo.name;
        task.config.imageId = repoInfo.digest;

        if (this.serviceEntity.name == 'berlioz_agent') {
            task.config.labels['berlioz:agent'] = 'true';
            task.config.labels['berlioz:native'] = 'true';
            task.setConfig('isNative', true);
            task.setConfig('isAgent', true);
        }

        return Promise.resolve()
            .then(() => this.clusterProcessor._setupReadyContainerObject(config, task))
            .then(readyTask => {
            })
            .then(() => {
                return Promise.serial(this.provides, x => this._configTaskProvided(config, task, x));
            })
            .then(() => Promise.serial(this._volumes, x => this._setupTaskVolume(config, task, x)))
            .then(() => Promise.serial(this.serviceEntity.storage, x => this._setupTaskBinds(config, task, x)))
            .then(() => {
                var environment = this.extractTaskEnvironment(config, task);
                task.setConfig('environment', environment)
            })
            ;
    }

    _setupTaskBinds(config, task, store)
    {
        if (store.kind != 'bind') 
        {
            return;
        }
        task.config.binds.push(store.source + ':' + store.path);
    }

    _configTaskProvided(config, task, provided)
    {
        var hostPort = this._getContainerEndPointHostPort(task, provided.networkProtocol, provided.port);
        task.config.ports[provided.networkProtocol][provided.port] = String(hostPort);

        if (provided.loadBalance)
        {
            return Promise.resolve(this._getLoadBalancer(config, provided))
                .then(lb => {
                    if (!lb) {
                        return;
                    }
                    var lbTarget = config.section('load-balancer-target').create([task.dn, provided.name])
                    lbTarget.setConfig('port', provided.port);
                    return Promise.resolve()
                        .then(() => lbTarget.relation(task))
                        .then(() => lb.relation(lbTarget).then(rel => rel.markIgnoreDelta()))
                });
        }
    }

    setupTasksDependencies(config)
    {
        var tasks = this._getMyTasks(config);
        return Promise.serial(tasks, x => this._setupTaskDependencies(config, x));
    }

    _setupTaskDependencies(config, task)
    {
        this._logger.info('[_setupTaskDependencies]  %s', task.dn);

        return Promise.resolve()
            .then(() => {
                var consumedServicesEntities = this.serviceEntity.localConsumes.map(x => x.localTarget);
                this._logger.info('[_setupTaskDependencies] %s, consumedServicesEntities: ', task.dn, consumedServicesEntities.map(x => x.id));
                consumedServicesEntities = _.uniqBy(consumedServicesEntities, x => x.id);
                this._logger.info('[_setupTaskDependencies] %s, unique consumedServicesEntities: ', task.dn, consumedServicesEntities.map(x => x.id));
                return Promise.serial(consumedServicesEntities, x => this._setupTaskToConsumedServiceDependencies(config, task, x))
            })
            .then(() => Promise.serial(this.serviceEntity.databasesConsumes, x => this._setupTaskToDatabaseDependency(config, task, x)))
            .then(() => Promise.serial(this.serviceEntity.queuesConsumes, x => this._setupTaskToQueueDependency(config, task, x)))
            .then(() => Promise.serial(this.serviceEntity.secretsConsumes, x => this._setupTaskToSecretDependency(config, task, x)))
            ;
    }

    _setupTaskToConsumedServiceDependencies(config, task, consumedServiceEntity)
    {
        this._logger.info('[_setupTaskToConsumedServiceDependencies] %s to %s', task.dn, consumedServiceEntity.id);

        var tasks = this._getServiceTasks(config, consumedServiceEntity)
        tasks = _.sortBy(tasks, x => parseInt(x.naming[3]));

        if (this.serviceEntity.id == consumedServiceEntity.id)
        {
            var identity = parseInt(task.naming[3]);
            tasks = tasks.filter(x => parseInt(x.naming[3]) < identity);
        }

        if (consumedServiceEntity.identity == 'sequential') {
            tasks = _.takeRight(tasks, 1);
        } else {
            tasks = _.take(tasks, 1);
        }

        return Promise.serial(tasks, x => {
            return task.relation('task', x.naming)
                .then(rel => rel.markIgnoreDelta());
        });
    }

    _setupTaskToDatabaseDependency(config, task, serviceDatabaseConsumed)
    {
        this._logger.info('[_setupTaskToDatabaseDependency] %s to %s', task.dn, serviceDatabaseConsumed.id);

        return Promise.resolve()
            .then(() => this.sectorProcessor.getDatabase(config, serviceDatabaseConsumed.localTarget))
            .then(dynamoDatabase => {
                if (!dynamoDatabase) {
                    return null;
                }
                return task.relation(dynamoDatabase)
                    .then(rel => rel.markIgnoreDelta());
            })
            ;
    }

    _setupTaskToQueueDependency(config, task, serviceQueueConsumed)
    {
        this._logger.info('[_setupTaskToQueueDependency] %s to %s', task.dn, serviceQueueConsumed.id);

        return Promise.resolve()
            .then(() => this.sectorProcessor.getQueue(config, serviceQueueConsumed.localTarget))
            .then(queue => {
                if (!queue) {
                    return null;
                }
                return task.relation(queue)
                    .then(rel => rel.markIgnoreDelta());
            })
            ;
    }

    _setupTaskToSecretDependency(config, task, serviceSecretConsumed)
    {
        this._logger.info('[_setupTaskToSecretDependency] %s to %s', task.dn, serviceSecretConsumed.id);

        this._logger.info('[_setupTaskToSecretDependency] %s to %s, target: %s', task.dn, serviceSecretConsumed.id, serviceSecretConsumed.targetId);
        var secretEntity = serviceSecretConsumed.localTarget;
        if (!secretEntity) {
            this._logger.error('[_setupTaskToSecretDependency] %s to %s, secret missing.', task.dn, serviceSecretConsumed.id);
            return;
        }
            
        return Promise.serial(serviceSecretConsumed.actions, action => {
            this._logger.info('[_setupTaskToSecretDependency] %s to %s, action: %s', task.dn, serviceSecretConsumed.id, action);
            return Promise.resolve(this.sectorProcessor.getSecretForAction(config, secretEntity, action))
                .then(keyAlias => {
                    if (!keyAlias) {
                        this._logger.warn('[_setupTaskToSecretDependency] alias missing for %s to %s, action: %s', task.dn, serviceSecretConsumed.id, action);
                        return;
                    }
                    return task.relation(keyAlias)
                        .then(rel => rel.markIgnoreDelta());    
                })

        })
    }

    _setupTaskVolume(config, task, volumeInfo)
    {
        // var identity = task.naming[3];
        // var volumeNaming = [this.deploymentName, this.clusterName, this.name, volumeInfo.name, identity];
        // var volume = config.section('volume').create(volumeNaming)
        //     .setConfig('size', volumeInfo.size)
        //     .setConfig('zone', instance.config.zone)
        //     .setConfig('hostPath', volumeInfo.hostPath);
        //
        // return Promise.resolve()
        //     .then(() => volume.relation(instance))
        //     .then(() => task.relation(volume));
    }

    _getTaskIpAddress(config, task)
    {
        return '0.0.0.0';
        // var containerInstance = task.findRelation('container-instance').targetItem;
        // var instance = containerInstance.findRelation('instance').targetItem;
        //
        // var niRelation = task.findRelation('network-interface');
        // if (niRelation)
        // {
        //     var ni = niRelation.targetItem;
        //     if (ni) {
        //         if (ni.obj) {
        //             return ni.obj.PrivateIpAddress;
        //         }
        //     }
        // }
        //
        // if (instance.config.existing) {
        //     return instance.obj.PrivateIpAddress;
        // }
        //
        // return 'not-present';
    }

    _getTaskListenAddress(config, task)
    {
        // var containerInstance = task.findRelation('container-instance').targetItem;
        // var instance = containerInstance.findRelation('instance').targetItem;
        //
        // for (var x of this.addressReserveDiscovery) {
        //     // TODO
        //     var ni = config.resolve('network-interface', [this.deploymentName, this.clusterName, this.name, task.naming[2]]);
        //     if (ni) {
        //         if (ni.obj) {
        //             return ni.obj.PrivateIpAddress;
        //         }
        //     }
        // }
        //
        return '0.0.0.0';
    }

    _calculateNextIdentity(config)
    {
        var myTasks = this._getMyTasks(config);

        var ids = myTasks.filter(x => 'BERLIOZ_IDENTITY' in x.config.environment)
                         .map(x => parseInt(x.config.environment['BERLIOZ_IDENTITY']));
        ids.push(0);

        var maxId = _.max(ids);
        return maxId + 1;
    }

    _getMyTasks(config)
    {
        return this._getServiceTasks(config, this.serviceEntity);
    }

    _getServiceTasks(config, serviceEntity)
    {
        return config.section('task').items.filter(x => {
            return (x.naming[0] == serviceEntity.clusterName) && (x.naming[1] == serviceEntity.sectorName) && (x.naming[2] == serviceEntity.name);
        });
    }

    getResource(name) {
        if (!this.definition.resources)
            return {};
        return this.definition.resources[name];
    }

    extractTaskEnvironment(config, task)
    {
        var berlizAgentIp = '172.17.0.1';

        var baseOverrides = {
            'BERLIOZ_TASK_ID': task.config.taskId,
            'BERLIOZ_ADDRESS': task.config.ipAddress,
            'BERLIOZ_IDENTITY': task.naming[3],
        };

        for (var provided of this.provides) {
            baseOverrides[provided.envListenPortName] = provided.port;
            // TODO: CHECK THIS CHANGE:
            // baseOverrides[provided.envProvidedPortName] = task.config.ports[provided.networkProtocol][provided.port];
            baseOverrides[provided.envProvidedPortName] = provided.port;
        }

        var baseEnv = this.extractBaseEnvironment(task.config.definitionIndex);
        var targetEnv = _.defaults(_.clone(baseOverrides), baseEnv);

        var serviceEnv = this.serviceEntity.environment;
        var userEnv = EnvTools.substituteEnvironment(serviceEnv, targetEnv);
        userEnv = EnvTools.substituteEnvironment(userEnv, userEnv);

        var finalEnv =  _.defaults(_.clone(targetEnv), userEnv);
        return finalEnv;
    }

    extractBaseEnvironment(definitionIndex) {
        var baseEnv = {
            'BERLIOZ_AGENT_PATH': '',
            'BERLIOZ_TASK_ID': '',
            'BERLIOZ_IDENTITY': 0,
            'BERLIOZ_ADDRESS': '0.0.0.0',
            'BERLIOZ_LISTEN_ADDRESS': '0.0.0.0',
            'BERLIOZ_INFRA': 'local',
            'BERLIOZ_REGION': 'earth-local',
            'BERLIOZ_INSTANCE_ID': 'local-1234',
            'BERLIOZ_CLUSTER': this.clusterName,
            'BERLIOZ_SECTOR': this.sectorName,
            'BERLIOZ_SERVICE': this.serviceName
        };

        for (var provided of this.provides) {
            baseEnv[provided.envProvidedPortName] = '';
            baseEnv[provided.envListenPortName] = '';
        }

        return baseEnv;
    }

    _massageProvidesConfig()
    {
        this._logger.info('[_massageProvidesConfig] begin');
        this._provides = {};

        for (var provided of _.values(this.serviceEntity.provides))
        {
            var hostPort = 0;
            var block = null;
            // if (this.getNetworkMode() == 'host' || provided.reserved) {
            //     hostPort = provided.port;
            //     block = { start: hostPort, end: hostPort };
            // } else {
            //     block = this.clusterProcessor._portAllocator.allocate(this.name, provided.port);
            // }

            var envProvidedPortName = 'BERLIOZ_PROVIDED_PORT_' + provided.name.toUpperCase();
            var envListenPortName = 'BERLIOZ_LISTEN_PORT_' + provided.name.toUpperCase();

            this._logger.info('[_massageProvidesConfig] %s :: %s, source: %s, port block:', this.serviceEntity.id, provided.name, provided.port, block);
            this._provides[provided.name] = {
                name: provided.name,
                port: provided.port,
                protocol: provided.protocol,
                networkProtocol: provided.networkProtocol,
                reserved: provided.reserved,
                loadBalance: provided.loadBalance,
                isPublic: provided.isPublic,
                dns: provided.dns,

                block: block,
                hostPort: hostPort,

                envProvidedPortName: envProvidedPortName,
                envListenPortName: envListenPortName
            };
        }

        this._logger.info('[_massageProvidesConfig] %s:', this.serviceEntity.id, this._provides);
    }

    _massageVolumeConfig()
    {
        for (var store of this.serviceEntity.storage)
        {
            if (store.kind == 'volume')
            {
                if (store.permanent)
                {
                    var name = store.path.replace(/\//gi,'_');
                    var volumeInfo = {
                        hostPath: '/volumes/' + this.serviceName + '/' + name,
                        name: name,
                        containerPath: store.path,
                        size: this._convertSizeToGb(store.size)
                    }
                    this._volumes.push(volumeInfo);
                }
            }
        }
    }

    _convertSizeToGb(size)
    {
        size = _.lowerCase(size);
        size = _.replace(size, 'gb', '');
        size = parseInt(size);
        return size;
    }

}

module.exports = ServiceProcessor;
