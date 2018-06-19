const _ = require('the-lodash');
const deepEqual = require('deep-equal');
const Promise = require('the-promise');

const RepoStore = require('processing-tools/repo-store');

class BaseTaskMetadataStore
{
    constructor(logger, meta, clusterEntity)
    {
        this._logger = logger;
        this._meta = meta;
        this._clusterEntity = clusterEntity;

        this._repoStore = new RepoStore(logger, 'taskmeta');
        this._repoStore.setupRepository('priorityEndpointsByService', 'PRIORITY ENDPOINTS BY SERVICE');
        this._repoStore.setupRepository('nativeResources', 'NATIVE RESOURCES BY DN');
        this._repoStore.setupRepository('massagedNativeResources', 'PROVIDED NATIVE RESOURCES');
        this._repoStore.setupRepository('serviceConsumerMap', 'SERVICE CONSUMER MAP (provider -> consumer)');
        this._repoStore.setupRepository('serviceProviderMap', 'SERVICE PROVIDER MAP (consumer -> provider)');
        this._repoStore.setupRepository('tasksByService', 'TASKS BY SERVICE');
        this._repoStore.setupRepository('endpointsByTask', 'ENDPOINTS BY TASK');
        this._repoStore.setupRepository('internalEndpointsByService', 'IN-CLUSTER ENDPOINTS BY SERVICE', this._massageEndpointByService.bind(this), 3);
        this._repoStore.setupRepository('externalByCluster', 'INTER-CLUSTER ENDPOINTS BY CLUSTER');
        this._repoStore.setupRepository('publicByCluster', 'PUBLIC ENDPOINTS BY CLUSTER');
        this._repoStore.setupRepository('consumedByService', 'CONSUMED BY SERVICE');
        this._repoStore.setupRepository('taskData', 'TASK METADATA', this._deployTaskData.bind(this), 1);
        this._repoStore.setupRepository('taskDataCurrent', 'CURRENT TASK METADATA');

        this._buildServiceConsumerMap();
    }

    get externalByCluster() {
        return this._repoStore.getRepository('externalByCluster');
    }

    get publicByCluster() {
        return this._repoStore.getRepository('publicByCluster');
    }

    get repoStore() {
        return this._repoStore;
    }

    markSuppressDeploy()
    {
        this._repoStore.markRepoSuppressProcess('taskData', [], true);
    }

    processTask(task)
    {
        if (!task) {
            throw new Error('Invalid task provided.');
        }
        this._logger.info('[processTask] taskDn: %s...', task.dn);
        var taskInfo = this._getTaskInfo(task.dn);
        if (!taskInfo) {
            return;
        }

        var clusterName = task.naming[0];
        var serviceName = task.naming[1];

        var service = this._getServiceDefinition(clusterName, serviceName);
        if (!service) {
            return null;
        }

        this._logger.info('Processing task: %s...', task.dn);
        this._logger.info('Service: %s::%s...', clusterName, serviceName);

        taskInfo.id = task.config.taskId;
        taskInfo.deployment = task.naming[0];
        taskInfo.cluster = clusterName;
        taskInfo.service = serviceName;

        this._extractTaskExtras(taskInfo, task, service);
        taskInfo.endpoints = this._extractTaskEndpoints(taskInfo, task, service);
        this._logger.info('[processTask] taskDn: %s, extracted endpoints:', task.dn, taskInfo.endpoints);

        var policies = this._extractTaskPolicies(taskInfo, task, service);
        this._logger.info('[processTask] taskDn: %s, policies:', task.dn, policies);

        return Promise.resolve()
            .then(() => this._setTaskMetadata(task.dn, 'endpoints', taskInfo.endpoints.internal))
            .then(() => this._setTaskMetadata(task.dn, 'policies', policies))
            .then(() => {
                var peers = this._repoStore.get('consumedByService', [taskInfo.cluster, taskInfo.service]);
                return this._setTaskMetadata(task.dn, 'peers', peers);
            })
            ;
    }

    deleteTask(dn)
    {
        var dnInfo = this._breakDn(dn);

        var service = this._getServiceDefinition(dnInfo.cluster, dnInfo.service);
        if (!service) {
            return null;
        }

        this._logger.info('[deleteTask] taskDn: %s...', dn);

        this._repoStore.delete('taskData', [dn]);
        this._repoStore.delete('tasksByService', [dnInfo.cluster, dnInfo.service, dn]);

        return Promise.serial(['internal', 'external', 'public'], location => {
            return Promise.serial(_.keys(service.provides), providedName => {

                this._repoStore.delete('endpointsByTask',
                    [dnInfo.cluster,
                     dnInfo.service,
                     providedName,
                     location,
                     dn]);

                return this._markEndpointByServiceDirty(dnInfo.cluster, dnInfo.service, providedName);
            })
        });
    }

    produceClusterEndpoints()
    {
        this._logger.info('[produceClusterEndpoints] :', _.values(this._clusterEntity.provides).map(x => x.id));
        return Promise.serial(_.values(this._clusterEntity.provides), provided => {
            return Promise.resolve()
                .then(() => this._produceClusterEndpoint(provided))
                .then(() => this._produceClusterPublicEndpoint(provided))
                ;
        });
    }

    _produceClusterEndpoint(provided)
    {
        this._logger.info('[_produceClusterEndpoint] %s...', provided.id);
        var endpointsMap = this._getPriorityEndpoints(provided.cluster.name, provided.service.name, provided.serviceProvided.name, 'internal');
        if (!endpointsMap)
        {
            endpointsMap = this._getPriorityEndpoints(provided.cluster.name, provided.service.name, provided.serviceProvided.name, 'public');
        }

        if (!endpointsMap)
        {
            endpointsMap =
                this._repoStore.get('endpointsByTask',
                    [provided.cluster.name,
                     provided.service.name,
                     provided.serviceProvided.name,
                     'external']);

            if (endpointsMap) {
                endpointsMap = _.mapKeys(endpointsMap, (value, key) => {
                    var dnInfo = this._breakDn(key);
                    return dnInfo.identity;
                });
            }
        }

        this._repoStore.set('externalByCluster',
            [provided.name], endpointsMap);
    }

    _produceClusterPublicEndpoint(provided)
    {
        if (!provided.isPublic) {
            return;
        }
        this._logger.info('[_produceClusterPublicEndpoint] %s...', provided.id);

        var endpointsMap = this._getPriorityEndpoints(provided.cluster.name, provided.service.name, provided.serviceProvided.name, 'public');

        if (!endpointsMap)
        {
            endpointsMap =
                this._repoStore.get('endpointsByTask',
                    [provided.cluster.name,
                     provided.service.name,
                     provided.serviceProvided.name,
                     'public']);

            if (endpointsMap) {
                endpointsMap = _.mapKeys(endpointsMap, (value, key) => {
                    var dnInfo = this._breakDn(key);
                    return dnInfo.identity;
                });
            }
        }

        this._repoStore.set('publicByCluster',
            [provided.name], endpointsMap);
    }

    _buildServiceConsumerMap()
    {
        for(var consumerService of this._clusterEntity.services)
        {
            for (var consumes of consumerService.localConsumes)
            {
                var mapPath = _.concat(consumes.targetKind, consumes.targetNaming[1], consumes.targetEndpoint, consumerService.kind, consumerService.naming);
                this._repoStore.at('serviceConsumerMap', mapPath);

                mapPath = _.concat(consumerService.kind, consumerService.naming, consumes.targetKind, consumes.targetNaming, consumes.targetEndpoint);
                this._repoStore.at('serviceProviderMap', mapPath);
            }

            for (var consumes of consumerService.databasesConsumes)
            {
                var mapPath = _.concat(consumes.targetKind, consumes.targetNaming[1], consumerService.kind, consumerService.naming);
                this._repoStore.at('serviceConsumerMap', mapPath);

                var mapPath = _.concat(consumerService.kind, consumerService.naming, consumes.targetKind, consumes.targetNaming[1]);
                this._repoStore.at('serviceProviderMap', mapPath);
            }

            for (var consumes of consumerService.queuesConsumes)
            {
                var mapPath = _.concat(consumes.targetKind, consumes.targetNaming[1], consumerService.kind, consumerService.naming);
                this._repoStore.at('serviceConsumerMap', mapPath);

                var mapPath = _.concat(consumerService.kind, consumerService.naming, consumes.targetKind, consumes.targetNaming[1]);
                this._repoStore.at('serviceProviderMap', mapPath);
            }

        }
    }

    _getPriorityEndpoints(clusterName, serviceName, providedName, location)
    {
        var endpointsMap = null;

        var priorityEndpoints = this._repoStore.get('priorityEndpointsByService',
            [clusterName, serviceName, providedName, location]);
        if (priorityEndpoints)
        {
            if (_.keys(priorityEndpoints).length > 0)
            {
                priorityEndpoints = priorityEndpoints[_.keys(priorityEndpoints)[0]];

                this._logger.verbose('[_getPriorityEndpoints] service=%s, endpoint: %s found %s priority', serviceName, providedName, location);
                endpointsMap = {
                    "0": priorityEndpoints
                };
            }
        }

        return endpointsMap;
    }

    _markEndpointByServiceDirty(clusterName, serviceName, providedName)
    {
        return this._repoStore.markDirtyRepo('internalEndpointsByService', [clusterName, serviceName, providedName]);
    }

    _massageEndpointByService(clusterName, serviceName, providedName)
    {
        this._logger.info('[_massageEndpointByService] service=%s, endpoint: %s', serviceName, providedName);

        var endpointsMap = this._getPriorityEndpoints(clusterName, serviceName, providedName, 'internal');
        if (!endpointsMap)
        {
            endpointsMap = this._getPriorityEndpoints(clusterName, serviceName, providedName, 'public');
        }

        if (!endpointsMap)
        {
            endpointsMap = {};

            var tasksDict = this._repoStore.get('endpointsByTask',
                [clusterName, serviceName, providedName, 'internal']);

            if (tasksDict)
            {
                for(var taskDn of _.keys(tasksDict))
                {
                    var dnInfo = this._breakDn(taskDn);
                    endpointsMap[dnInfo.identity] = tasksDict[taskDn];
                }
            }
        }

        this._repoStore.set('internalEndpointsByService',
            [serviceName,
             providedName],
            endpointsMap);

        return this._markEndpointsConsumerServicesDirty(serviceName);
    }

    _markEndpointsConsumerServicesDirty(providerServiceName)
    {
        return this._repoStore.loop('serviceConsumerMap',
            ['service',
             providerServiceName],
            (endpoint, consumerDict) => {
                if (!consumerDict.service) {
                    return;
                }
                consumerDict = consumerDict.service;
                return Promise.serial(_.keys(consumerDict), consumerCluster => {
                    return Promise.serial(_.keys(consumerDict[consumerCluster]), consumerService => {
                        this._calculateConsumers(consumerCluster, consumerService, providerServiceName, endpoint);
                        return this._markConsumerTasksDirty(consumerCluster, consumerService);
                    })
                });
            });
    }

    _markNativeResourcesDirty(dictPath)
    {
        var resources = this._repoStore.get('nativeResources', dictPath);
        var massaged = {};
        if (resources) {
            var index = 0;
            for(var key of _(resources).keys().sortBy().value())
            {
                massaged[index] = resources[key];
                index ++;
            }
        }
        this._repoStore.set('massagedNativeResources', dictPath, massaged);

        return this._markNativeResourceConsumerServicesDirty(dictPath[0], dictPath[2]);
    }

    _markNativeResourceConsumerServicesDirty(resourceKind, providerResourceName)
    {
        return this._repoStore.loop('serviceConsumerMap',
            [resourceKind,
             providerResourceName],
            (consumerKind, consumerDict) => {
                if (consumerKind != 'service') {
                    return;
                }
                return Promise.serial(_.keys(consumerDict), consumerCluster => {
                    return Promise.serial(_.keys(consumerDict[consumerCluster]), consumerService => {
                        this._calculateNativeResourceConsumers(consumerCluster, consumerService, resourceKind, providerResourceName);
                        return this._markConsumerTasksDirty(consumerCluster, consumerService);
                    })
                });
            });
    }

    _calculateNativeResourceConsumers(consumerCluster, consumerService,
                                      resourceKind, providerResourceName)
    {
        var massagedResources = this._repoStore.get('massagedNativeResources',
            [resourceKind,
             consumerCluster,
             providerResourceName]);
        this._repoStore.set('consumedByService',
            [consumerCluster,
             consumerService,
             resourceKind,
             providerResourceName],
            massagedResources);
    }

    _calculateConsumers(consumerCluster, consumerService,
                        providerServiceName, providerEndpoint)
    {
        var massagedEndpoints = this._repoStore.get('internalEndpointsByService',
            [providerServiceName,
             providerEndpoint]);
        this._repoStore.set('consumedByService',
            [consumerCluster,
             consumerService,
             'service',
             providerServiceName,
             providerEndpoint],
            massagedEndpoints);
    }

    _markConsumerTasksDirty(clusterName, serviceName)
    {
        this._logger.info('_markConsumedTaskDirty service=%s', serviceName);
        var consumerData = this._repoStore.get('consumedByService', [clusterName, serviceName]);

        return this._repoStore.loop('tasksByService', [clusterName, serviceName],
            taskDn => {
                this._logger.info('_markConsumedTaskDirty task=%s', taskDn);
                this._setTaskMetadata(taskDn, 'peers', consumerData);
            });
    }

    processTaskToConsumers(taskDn)
    {
        this._logger.info('[processTaskToConsumers] taskDn: %s...', taskDn);
        var taskInfo = this._getTaskInfo(taskDn);
        if (!taskInfo) {
            return;
        }

        var endpointsMap = taskInfo.endpoints;
        return Promise.serial(_.keys(endpointsMap), location => {
            return Promise.serial(_.keys(endpointsMap[location]), providedName => {
                var endpoints = endpointsMap[location][providedName];

                this._repoStore.set('endpointsByTask',
                    [taskInfo.cluster,
                     taskInfo.service,
                     providedName,
                     location,
                     taskDn],
                     endpoints);

                return this._markEndpointByServiceDirty(taskInfo.cluster, taskInfo.service, providedName);
            })
        });
    }

    deploy()
    {
        this._logger.info('[deploy] BEGIN');

        return Promise.resolve()
            .then(() => this._repoStore.markRepoSuppressProcess('taskData', [], false))
            .then(() => this._repoStore.outputRepository('taskDataCurrent'))
            .then(() => this._logger.info('[deploy] END'))
            ;
    }

    _deployTaskData(taskDn)
    {
        this._logger.info('[_deployTaskData] %s...', taskDn);

        // this._repoStore.delete('dirtyTasks', [taskDn]);

        var taskInfo = this._repoStore.get('taskData', [taskDn]);
        if (!taskInfo) {
            this._logger.info('[_deployTaskData] %s. No new task data', taskDn);
            return;
        }

        var taskMessage = {
            id: taskInfo.id,
            metadata: taskInfo.metadata
        }
        this._logger.silly('[_deployTaskData] task %s -> %s metadata...', taskInfo.dn, taskInfo.id, taskMessage);

        return Promise.resolve()
            .then(() => this._deployTaskMessage(taskInfo.dn, taskInfo.id, taskMessage))
            .then(() => {
                this._repoStore.set('taskDataCurrent', [taskDn], _.cloneDeep(taskInfo));
            })
            ;
    }

    _deployTaskMessage(taskDn, taskId, taskMessage)
    {

    }

    _getTaskInfo(dn)
    {
        var taskInfo = this._repoStore.get('taskData', [dn]);
        if (!taskInfo) {
            var dnInfo = this._breakDn(dn);

            var service = this._getServiceDefinition(dnInfo.cluster, dnInfo.service);
            if (!service) {
                return null;
            }

            this._repoStore.set('taskData', [dn], {
                dn: dn,
                metadata: {}
            });

            this._repoStore.at('tasksByService',
                [dnInfo.cluster,
                 dnInfo.service,
                 dn]);
        }
        return this._repoStore.get('taskData', [dn]);
    }

    _setTaskMetadata(taskDn, section, value)
    {
        var sectionPath = [taskDn, 'metadata', section];
        this._repoStore.set('taskData', sectionPath, value);

        this._logger.info('[_setTaskMetadata] %s :: %s...', taskDn, section);
        this._logger.silly('[_setTaskMetadata] %s :: %s = ', taskDn, section, value);


        var dirtyCheckPath = [taskDn, 'metadata'];
        var currentValue = this._repoStore.get('taskDataCurrent', dirtyCheckPath);
        var targetValue = this._repoStore.get('taskData', dirtyCheckPath);

        if (deepEqual(targetValue, currentValue))
        {
            return this._repoStore.unmarkDirtyRepo('taskData', [taskDn]);
        }
        else
        {
            return this._repoStore.markDirtyRepo('taskData', [taskDn]);
        }
    }

    _getServiceDefinition(clusterName, serviceName)
    {
        if (this._clusterEntity.name != clusterName)
        {
            return null;
        }
        return this._clusterEntity.getServiceByName(serviceName);
    }

    outputRepositories()
    {
        return Promise.resolve()
            .then(() => this._repoStore.outputRepositories())
            ;

    }

}

module.exports = BaseTaskMetadataStore;
