const _ = require('the-lodash');
const Promise = require('the-promise');
const request = require('request-promise');
const arnParser = require('aws-arn-parser');

const BaseTaskMetadataStore = require('./base-task-metadata-store');

class TaskMetadataStore extends BaseTaskMetadataStore
{
    constructor(rootProcessor, logger, meta, clusterEntity, currentConfig)
    {
        super(logger, meta, clusterEntity);

        this._rootProcessor = rootProcessor;
        this._currentConfig = currentConfig;
        this._buildServiceConsumerMap();
    }

    extract()
    {
        return Promise.resolve()
            .then(() => this._repoStore.markRepoSuppressProcess('internalEndpointsByService', [], true))
            .then(() => {
                return Promise.serial(this._currentConfig.section('dynamodb').items, item => {
                    return Promise.resolve()
                        .then(() => this.createDynamo(item))
                        ;
                })
            })
            .then(() => {
                return Promise.serial(this._currentConfig.section('kinesis').items, item => {
                    return Promise.resolve()
                        .then(() => this.createKinesis(item))
                        ;
                })
            })
            .then(() => {
                return Promise.serial(this._currentConfig.section('load-balancer').items, item => {
                    return Promise.resolve()
                        .then(() => this.createLoadBalancer(item))
                        ;
                })
            })
            .then(() => {
                return Promise.serial(this._currentConfig.section('task').items, task => {
                    return Promise.resolve()
                        .then(() => this.processTask(task))
                        .then(() => this.processTaskToConsumers(task.dn))
                        ;
                })
            })
            .then(() => this._repoStore.markRepoSuppressProcess('internalEndpointsByService', [], false))
            .then(() => this.outputRepositories());
    }

    _extractTaskExtras(taskInfo, task, service)
    {

    }

    _extractTaskEndpoints(taskInfo, task, service)
    {
        this._logger.info('[_extractTaskEndpoints] task: %s, service: %s', task.dn, service.name);

        var endpointsMeta = {
            internal: {},
            external: {},
            public: {}
        };

        var containerIp = this._rootProcessor.getContainerIp(task.obj);
        if (!containerIp) {
            this._logger.warn('[_extractTaskEndpoints] task: %s, container ip not present. taskObj: ', task.dn, task.obj);
            return endpointsMeta;
        }

        for (var provided of _.values(service.provides))
        {
            var hostPort = task.config.ports[provided.networkProtocol][provided.port];

            endpointsMeta.internal[provided.name] = {
                name: provided.name,
                protocol: provided.protocol,
                networkProtocol: provided.networkProtocol,
                port: provided.port,
                address: containerIp
            };
            endpointsMeta.external[provided.name] = {
                name: provided.name,
                protocol: provided.protocol,
                networkProtocol: provided.networkProtocol,
                port: provided.port,
                address: containerIp
            };
            endpointsMeta.public[provided.name] = {
                name: provided.name,
                protocol: provided.protocol,
                networkProtocol: provided.networkProtocol,
                port: hostPort,
                address: '127.0.0.1'
            };
        }
        return endpointsMeta;
    }

    _getLbLocations(loadBalancer)
    {
        return ['internal', 'public'];
    }

    createLoadBalancer(loadBalancer)
    {
        this._logger.info('[createLoadBalancer] %s...', loadBalancer.dn);

        for(var location of this._getLbLocations(loadBalancer))
        {
            this._createLoadBalancer(loadBalancer, location);
        }

        return this._markEndpointByServiceDirty(loadBalancer.naming[0], loadBalancer.naming[1], loadBalancer.naming[2]);
    }

    _createLoadBalancer(loadBalancer, location)
    {
        this._logger.info('[createLoadBalancer] %s...', loadBalancer.dn);

        var internalPort = 80;

        var dictPath =
            [loadBalancer.naming[0],
             loadBalancer.naming[1],
             loadBalancer.naming[2],
             location,
             loadBalancer.dn];

        var info = {
            name: loadBalancer.naming[2]
        }
        info.protocol = 'http',
        info.networkProtocol = 'tcp';

        if (location == 'internal')
        {
            info.port = internalPort;
            info.address = this._rootProcessor.getContainerIp(loadBalancer.obj);
        }
        else
        {
            info.port = loadBalancer.config.ports[info.networkProtocol][internalPort];
            info.address = '127.0.0.1';
        }

        if (!info.address) {
            return;
        }

        this._repoStore.set('priorityEndpointsByService', dictPath, info);

        return this._markEndpointByServiceDirty(loadBalancer.naming[0], loadBalancer.naming[1], loadBalancer.naming[2]);
    }

    deleteLoadBalancer(loadBalancer)
    {
        this._logger.info('[deleteLoadBalancer] %s...', loadBalancer.dn);

        for(var location of this._getLbLocations(loadBalancer))
        {
            var dictPath =
                [loadBalancer.naming[0],
                 loadBalancer.naming[1],
                 loadBalancer.naming[2],
                 location,
                 loadBalancer.dn];

            this._repoStore.delete('priorityEndpointsByService', dictPath);
        }

        return this._markEndpointByServiceDirty(loadBalancer.naming[0], loadBalancer.naming[1], loadBalancer.naming[2]);
    }

    createDynamo(dynamo)
    {
        this._logger.info('[createDynamo] %s...', dynamo.dn);

        var dictPath =
            ['database',
             dynamo.naming[1],
             dynamo.naming[2],
             dynamo.dn];

        var info = {
            name: dynamo.obj.TableName,
            class: 'nosql',
            subClass: 'dynamodb'
        }
        this._setupNativeResourceConfig(info, dynamo.obj.TableArn);

        this._repoStore.set('nativeResources', dictPath, info);
        return this._markNativeResourcesDirty(_.take(dictPath, 3));
    }

    deleteDynamo(dynamo)
    {
        this._logger.info('[deleteDynamo] %s...', dynamo.dn);

        var dictPath =
            ['database',
             dynamo.naming[1],
             dynamo.naming[2],
             dynamo.dn];

        this._repoStore.delete('nativeResources', dictPath);
        return this._markNativeResourcesDirty(_.take(dictPath, 3));
    }

    createKinesis(kinesis)
    {
        this._logger.info('[createKinesis] %s...', kinesis.dn);

        var dictPath =
            ['queue',
             kinesis.naming[1],
             kinesis.naming[2],
             kinesis.dn];

        var info = {
            name: kinesis.obj.StreamName,
            class: 'queue',
            subClass: 'kinesis'
        }
        this._setupNativeResourceConfig(info, kinesis.obj.StreamARN);

        this._repoStore.set('nativeResources', dictPath, info);
        return this._markNativeResourcesDirty(_.take(dictPath, 3));
    }

    deleteKinesis(kinesis)
    {
        this._logger.info('[deleteKinesis] %s...', kinesis.dn);

        var dictPath =
            ['database',
             kinesis.naming[1],
             kinesis.naming[2],
             kinesis.dn];

        this._repoStore.delete('nativeResources', dictPath);
        return this._markNativeResourcesDirty(_.take(dictPath, 3));
    }

    _deployTaskMessage(taskDn, taskId, taskMessage)
    {
        var agentTask = this._rootProcessor._clusterProcessor.getBerliozAgentTask(this._currentConfig);
        if (!agentTask) {
            this._logger.info('[_deployTaskMessage] skipped for %s. No agent.', taskDn);
            return;
        }

        var hostPort = agentTask.config.ports['tcp']['55555'];
        if (!hostPort) {
            this._logger.info('[_deployTaskMessage] skipped for %s. No agent hostPort.', taskDn);
            return;
        }

        var options = {
            method: 'POST',
            uri: 'http://127.0.0.1:' + hostPort + '/report',
            body: [taskMessage],
            json: true
        };

        this._logger.verbose('[_deployTaskMessage] reporting to %s...', options.uri, options.body);
        return request(options)
            .then(result =>  {
                this._logger.verbose('[_deployTaskMessage] RESPONSE:', result);
            })
            .catch(err => {
                this._logger.error('[_deployTaskMessage] RESPONSE ERROR:', err.message);
                this._logger.exception(err);
                // throw err;
            });
    }

    _setupNativeResourceConfig(info, objectArn)
    {
        info.config = {};
        if (this._rootProcessor._awsCredentials) {
            info.config.credentials = {
                accessKeyId: this._rootProcessor._awsCredentials.key,
                secretAccessKey: this._rootProcessor._awsCredentials.secret
            }
        }
        var arn = arnParser(objectArn);
        info.config.region = arn.region;
    }

    _breakDn(dn)
    {
        var dnInfo = this._meta.breakDn(dn);
        return {
            cluster: dnInfo.naming[0],
            service: dnInfo.naming[1],
            identity: dnInfo.naming[2]
        };
    }


}

module.exports = TaskMetadataStore;
