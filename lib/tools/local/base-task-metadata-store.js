const _ = require('the-lodash');
const Promise = require('the-promise');

const RepoStore = require('processing-tools/repo-store');
const EndpointsProcessor = require("../../berlioz-common/processing/endpoint-processor");
const PeersFetcher = require("../../berlioz-common/processing/peers-fetcher");

class BaseTaskMetadataStore
{
    constructor(rootProcessor, logger, meta, clusterEntity)
    {
        this._rootProcessor = rootProcessor;
        this._logger = logger;
        this._meta = meta;
        this._clusterEntity = clusterEntity;

        this._repoStore = new RepoStore(logger, 'taskmeta');
        this._repoStore.setupRepository('serviceConsumerMap', 'SERVICE CONSUMER MAP (provider -> consumer)');
        this._repoStore.setupRepository('serviceProviderMap', 'SERVICE PROVIDER MAP (consumer -> provider)');
        this._repoStore.setupRepository('consumedMeta', 'CONSUMED META MAP (consumer -> provider)');
        this._repoStore.setupRepository('taskData', 'TASK METADATA', this._deployTaskData.bind(this), 1);
        this._repoStore.setupRepository('taskDataCurrent', 'CURRENT TASK METADATA');

        this._peersFetcher = new PeersFetcher(
            logger.sublogger("PeersFetcher"),
            rootProcessor._tableImpl);

        this._buildServiceConsumerMap();
    }

    get repoStore() {
        return this._repoStore;
    }

    get endpointProcessor() {
        return this._rootProcessor._endpointProcessor;
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

        var service = this._getServiceDefinition(task.dn);
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
            .then(() => {
                var consumesMeta = this._repoStore.get('consumedMeta', [taskInfo.serviceId]);
                return this._setTaskMetadata(task.dn, 'consumes', consumesMeta);
            })
            .then(() => {
                var peers = this._peersFetcher.getMyPeers(service);
                this._logger.info("[processTask] %s PEERS: ", service.id, peers)
                return this._setTaskMetadata(task.dn, 'peers', peers);
            })
            .then(() => {
                this.endpointProcessor.reportTask(service, task, taskInfo.endpoints);
            })
            ;
    }

    _buildServiceConsumerMap()
    {
        for(var consumerService of this._clusterEntity.services)
        {
            var serviceConsumedMeta = [];
            for (var consumes of consumerService.localConsumes)
            {
                serviceConsumedMeta.push({
                    kind: 'service',
                    id: consumes.targetId,
                    cluster: consumes.targetNaming[0],
                    sector: consumes.targetNaming[1],
                    name: consumes.targetNaming[2],
                    endpoint: consumes.targetEndpoint,
                    isolation: consumes.isolation
                });

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
                serviceConsumedMeta.push({
                    kind: 'database',
                    id: consumes.targetId,
                    cluster: consumes.targetNaming[0],
                    sector: consumes.targetNaming[1],
                    name: consumes.targetNaming[2],
                    endpoint: consumes.targetEndpoint
                });

                var mapPath = _.concat(consumes.targetId, consumerService.id);
                this._repoStore.at('serviceConsumerMap', mapPath);

                var mapPath = _.concat(consumerService.id, consumes.targetId);
                this._repoStore.at('serviceProviderMap', mapPath);
            }

            for (var consumes of consumerService.queuesConsumes)
            {
                serviceConsumedMeta.push({
                    kind: 'queue',
                    id: consumes.targetId,
                    cluster: consumes.targetNaming[0],
                    sector: consumes.targetNaming[1],
                    name: consumes.targetNaming[2],
                    endpoint: consumes.targetEndpoint
                });

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

            for (var consumed of consumerService.metaConsumes)
            {
                var targetSector = consumed.localTarget;
                for (var consumedService of targetSector.services)
                {
                    serviceConsumedMeta.push({
                        kind: 'service',
                        meta: true,
                        id: consumedService.id,
                        cluster: consumedService.naming[0],
                        sector: consumedService.naming[1],
                        name: consumedService.naming[2]
                    });
                }
            }

            this._repoStore.set('consumedMeta', [consumerService.id], serviceConsumedMeta);
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
        this._logger.debug('[_deployTaskData] task %s -> %s metadata...', taskInfo.dn, taskInfo.id, taskMessage);

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
            var service = this._getServiceDefinition(dn);
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

    _getServiceDefinition(taskDn)
    {
        var dnInfo = this._meta.breakDn(taskDn);
        if (this._clusterEntity.name != dnInfo.naming[0])
        {
            return null;
        }
        this._logger.debug('[_getServiceDefinition] task: %s', taskDn)
        return this._clusterEntity.getServiceByNaming(dnInfo.naming[1], dnInfo.naming[2]);
    }

    outputRepositories()
    {
        return Promise.resolve()
            .then(() => this._repoStore.outputRepositories())
            ;

    }

}

module.exports = BaseTaskMetadataStore;
