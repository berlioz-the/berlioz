const _ = require('the-lodash');
const Promise = require('the-promise');

const RepoStore = require('processing-tools/repo-store');

class BaseTaskMetadataStore
{
    constructor(rootProcessor, logger, meta, clusterEntity)
    {
        this._rootProcessor = rootProcessor;
        this._logger = logger;
        this._meta = meta;
        this._clusterEntity = clusterEntity;

        this._repoStore = new RepoStore(logger, 'taskmeta');
        this._repoStore.setupRepository('serviceConsumerMap').description('SERVICE CONSUMER MAP (provider -> consumer)');
        this._repoStore.setupRepository('serviceProviderMap').description('SERVICE PROVIDER MAP (consumer -> provider)');
        this._repoStore.setupRepository('taskData').description('TASK METADATA').handleDirty(this._deployTaskData.bind(this), 1);
        this._repoStore.setupRepository('taskDataCurrent').description('CURRENT TASK METADATA');

        this._buildServiceConsumerMap();
    }

    get repoStore() {
        return this._repoStore;
    }

    get rootProcessor() {
        return this._rootProcessor;
    }

    get endpointProcessor() {
        return this.rootProcessor.endpointProcessor;
    }

    get nativeProcessor() {
        return this.rootProcessor.nativeProcessor;
    }

    get peersFetcher() {
        return this._rootProcessor.peersFetcher;
    }

    get hasAwsProvider() {
        return this.rootProcessor.hasAwsProvider;
    }

    get hasGcpProvider() {
        return this.rootProcessor.hasGcpProvider;
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

        var service = this._getServiceEntity(task.dn);
        if (!service) {
            return null;
        }

        this._logger.info('Processing task: %s...', task.dn);

        taskInfo.id = task.config.taskId;
        taskInfo.deployment = task.naming[0];

        taskInfo.endpoints = this._extractTaskEndpoints(taskInfo, task, service);
        this._logger.info('[processTask] taskDn: %s, extracted endpoints:', task.dn, taskInfo.endpoints);

        var policies = this._extractTaskPolicies(taskInfo, task, service);
        this._logger.info('[processTask] taskDn: %s, policies:', task.dn, policies);

        return Promise.resolve()
            .then(() => this._setTaskMetadata(task.dn, 'endpoints', taskInfo.endpoints.internal))
            .then(() => this._setTaskMetadata(task.dn, 'policies', policies))
            .then(() => this.rootProcessor.metadataProcessor.collectServiceConsumedMeta(service))
            .then(consumesMeta => {
                return this._setTaskMetadata(task.dn, 'consumes', consumesMeta);
            })
            .then(() => {
                var peers = this.peersFetcher.getMyPeers(service);
                var finalPeers = _.clone(peers);

                var taskMetaItem = task.findRelation("task-metadata").targetItem;

                var nativePeers = this.nativeProcessor.produceConsumerPeers(taskMetaItem);
                this._logger.info("[processTask] %s nativePeers: ", service.id, nativePeers)

                if (nativePeers) {
                    nativePeers = _.clone(nativePeers);
                    finalPeers = _.defaults(nativePeers, finalPeers);
                }

                this._logger.info("[processTask] %s PEERS: ", service.id, finalPeers)
                return this._setTaskMetadata(task.dn, 'peers', finalPeers);
            })
            .then(() => {
                // this.endpointProcessor.reportTask(service, task, taskInfo.endpoints);
            })
            ;
    }

    _buildServiceConsumerMap()
    {
        for(var consumerService of this._clusterEntity.services)
        {            
            for (var consumes of consumerService.localConsumes)
            {
                var info = {
                    isolation: consumes.isolation
                };
                var mapPath = _.concat(consumes.targetId, consumes.targetEndpoint, consumerService.id);
                this._repoStore.at('serviceConsumerMap', mapPath);

                mapPath = _.concat(consumerService.id, consumes.targetId, consumes.targetEndpoint);
                this._repoStore.set('serviceProviderMap', mapPath, info);
            }

            for (var consumes of consumerService.databasesConsumes)
            {
                var mapPath = _.concat(consumes.targetId, consumerService.id);
                this._repoStore.at('serviceConsumerMap', mapPath);

                var mapPath = _.concat(consumerService.id, consumes.targetId);
                this._repoStore.at('serviceProviderMap', mapPath);
            }

            for (var consumes of consumerService.queuesConsumes)
            {
                var mapPath = _.concat(consumes.targetId, consumerService.id);
                this._repoStore.at('serviceConsumerMap', mapPath);

                var mapPath = _.concat(consumerService.id, consumes.targetId);
                this._repoStore.at('serviceProviderMap', mapPath);
            }

            for (var consumes of consumerService.secretsConsumes)
            {
                for (var action of consumes.actions) 
                {
                    // TODO: IMPLEMENT
                    // var targetKind = 'secret_'
                    // if (action == 'encrypt') {
                    //     targetKind += 'public_key'
                    // } else {
                    //     targetKind += 'private_key'
                    // }
                    // var mapPath = _.concat(targetKind, consumes.targetNaming[1], consumerService.kind, consumerService.naming);
                    // this._repoStore.at('serviceConsumerMap', mapPath);
    
                    // var mapPath = _.concat(consumerService.kind, consumerService.naming, targetKind, consumes.targetNaming[1]);
                    // this._repoStore.at('serviceProviderMap', mapPath);
                }
            }
        }
    }

    deploy()
    {
        this._logger.info('[deploy] BEGIN');

        return Promise.resolve()
            .then(() => this.endpointProcessor.finish())
            .then(() => this._repoStore.markRepoSuppressProcess('taskData', [], false))
            .then(() => this._repoStore.outputRepository('taskDataCurrent'))
            .then(() => this._logger.info('[deploy] END'))
            ;
    }

    _deployTaskData(taskDn)
    {
        this._logger.info('[_deployTaskData] %s...', taskDn);

        // this._repoStore.delete('dirtyTasks', [taskDn]);

        var taskInfo = this._getTaskInfo(taskDn, true);
        if (!taskInfo) {
            this._logger.info('[_deployTaskData] %s. No new task data', taskDn);
            return;
        }

        var taskMessage = {
            id: taskInfo.id,
            metadata: taskInfo.metadata
        }
        this._logger.info('[_deployTaskData] task %s -> %s metadata...', taskInfo.dn, taskInfo.id, taskMessage);

        return Promise.resolve()
            .then(() => {
                return Promise.retry(() => this._deployTaskMessage(taskInfo.dn, taskInfo.id, taskMessage),
                    3,
                    1000)
            })
            .then(() => {
                this._repoStore.set('taskDataCurrent', [taskDn], _.cloneDeep(taskInfo));
            })
            .catch(err => {
                this._logger.error('[_deployTaskData] ERROR:', err.message);
                this._logger.exception(err);
            });
            ;
    }

    _deployTaskMessage(taskDn, taskId, taskMessage)
    {

    }

    _getTaskInfo(dn, skipCreate)
    {
        var taskInfo = this._repoStore.get('taskData', [dn]);
        if (!taskInfo) {
            if (skipCreate) {
                return null;
            }
            var service = this._getServiceEntity(dn);
            if (!service) {
                return null;
            }

            this._repoStore.set('taskData', [dn], {
                dn: dn,
                serviceId: service.id,
                metadata: {}
            });
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

        if (_.fastDeepEqual(targetValue, currentValue))
        {
            return this._repoStore.unmarkDirtyRepo('taskData', [taskDn]);
        }
        else
        {
            return this._repoStore.markDirtyRepo('taskData', [taskDn]);
        }
    }

    _getServiceEntity(taskDn)
    {
        var x = this._getServiceProcessor(taskDn);
        if (!x) {
            return null;
        }
        return x.serviceEntity;
    }

    _getServiceProcessor(taskDn)
    {
        var dnInfo = this._meta.breakDn(taskDn);
        if (this._clusterEntity.name != dnInfo.naming[0])
        {
            return null;
        }
        var x = this.rootProcessor;
        x = x.clusterProcessor;
        x = x.getSectorProcessor(dnInfo.naming[1]);
        if (!x) {
            return null;
        }
        x = x.getServiceProcessor(dnInfo.naming[2]);
        if (!x) {
            return null;
        }
        return x;
    }

    outputRepositories()
    {
        return Promise.resolve()
            .then(() => this._repoStore.outputRepositories())
            ;
    }

}

module.exports = BaseTaskMetadataStore;
