const _ = require('the-lodash');
const Promise = require('the-promise');
const request = require('request-promise');
const arnParser = require('aws-arn-parser');

const BaseTaskMetadataStore = require('./base-task-metadata-store');
const BaseItem = require('../../berlioz-common/entities/base');

class TaskMetadataStore extends BaseTaskMetadataStore
{
    constructor(rootProcessor, logger, meta, clusterEntity, currentConfig)
    {
        super(rootProcessor, logger, meta, clusterEntity);

        this._currentConfig = currentConfig;
        this._buildServiceConsumerMap();
    }

    extract()
    {
        return Promise.resolve()
            .then(() => this.endpointProcessor.processClusterDependencies(this._clusterEntity))
            .then(() => this.peersFetcher.prefetchClusterDependencies(this._clusterEntity))
            .then(() => {
                return Promise.serial(this._currentConfig.section('parameter').items, item => {
                    return Promise.resolve()
                        .then(() => this.createParameter(item))
                        ;
                })
            })
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
                        ;
                })
            })
            .then(() => this.endpointProcessor.reportOverriddenEndpoints(this._clusterEntity))
            .then(() => this.endpointProcessor.prepareFinal(this._clusterEntity))
            .then(() => this.outputRepositories());
    }

    _extractTaskEndpoints(taskInfo, task, service)
    {
        this._logger.info('[_extractTaskEndpoints] task: %s, service: %s', task.dn, service.name);

        var endpointsMeta = {
            internal: {},
            external: {},
            public: {}
        };

        var containerIp = this.rootProcessor.getContainerIp(task.obj);
        if (!containerIp) {
            this._logger.warn('[_extractTaskEndpoints] task: %s, container ip not present. taskObj: ', task.dn, task.obj);
            return endpointsMeta;
        }

        for (var provided of _.values(service.provides))
        {
            var hostPort = task.config.ports[provided.networkProtocol][provided.port];

            endpointsMeta.internal[provided.name] = {
                protocol: provided.protocol,
                networkProtocol: provided.networkProtocol,
                port: provided.port,
                address: containerIp
            };
            endpointsMeta.external[provided.name] = {
                protocol: provided.protocol,
                networkProtocol: provided.networkProtocol,
                port: provided.port,
                address: containerIp
            };
            endpointsMeta.public[provided.name] = {
                protocol: provided.protocol,
                networkProtocol: provided.networkProtocol,
                port: hostPort,
                address: '127.0.0.1'
            };
        }
        return endpointsMeta;
    }

    _extractTaskPolicies(taskInfo, task, service)
    {
        var policies = service.buildTaskPolicy();
        return policies;
    }

    createLoadBalancer(loadBalancer)
    {
        this._logger.info('[createLoadBalancer] %s...', loadBalancer.dn);

        var endpointsInfo = this._extractLoadBalancerEndpoints(loadBalancer);

        var serviceId = BaseItem.constructID('service', [loadBalancer.naming[0], loadBalancer.naming[1], loadBalancer.naming[2]]);
        var serviceEntity = this._clusterEntity.registry.findById(serviceId);
        var serviceProvided = serviceEntity.provides[loadBalancer.naming[3]];

        this.endpointProcessor.reportLoadBalancer(serviceProvided, endpointsInfo);
    }

    _extractLoadBalancerEndpoints(loadBalancer)
    {
        var endpointsMeta = {
            internal: {},
            external: {},
            public: {}
        };

        var info = {
            name: loadBalancer.naming[3],
            protocol: 'http',
            networkProtocol: 'tcp'
        };

        var internalPort = 80;

        endpointsMeta.internal = _.clone(info);
        endpointsMeta.internal.port = internalPort;
        endpointsMeta.internal.address = this.rootProcessor.getContainerIp(loadBalancer.obj);

        endpointsMeta.external = _.clone(endpointsMeta.internal);
        
        endpointsMeta.public = _.clone(info);
        endpointsMeta.public.port = loadBalancer.config.ports[info.networkProtocol][internalPort];
        endpointsMeta.public.address = '127.0.0.1';

        return endpointsMeta;
    }

    createParameter(parameter)
    {
        // TODO: Add support later
        // this._logger.info('[createParameter] %s...', parameter.dn);

        // var dictPath =
        //     [parameter.naming[3],
        //     parameter.naming[1],
        //     parameter.naming[2],
        //     parameter.dn];

        // var info = {
        //     name: parameter.obj.Name,
        //     class: 'secret',
        //     subClass: 'rsa-secret'
        // }

        // this._setupNativeResourceConfig(info)

        // this._repoStore.set('nativeResources', dictPath, info);
        // return this._markNativeResourcesDirty(_.take(dictPath, 3));
    }

    createDynamo(dynamo)
    {
        this._logger.info('[createDynamo] %s...', dynamo.dn);

        var svcId = BaseItem.constructID('database', [dynamo.naming[1], dynamo.naming[2], dynamo.naming[3]]);
        var dictPath =
            [svcId,
             dynamo.dn];

        var info = {
            name: dynamo.obj.TableName,
            class: 'nosql',
            subClass: 'dynamodb'
        }
        this._setupNativeResourceConfig(info, dynamo.obj.TableArn);

        this.endpointProcessor.reportNative(svcId, dynamo, info);
    }

    createKinesis(kinesis)
    {
        this._logger.info('[createKinesis] %s...', kinesis.dn);

        var svcId = BaseItem.constructID('queue', [kinesis.naming[1], kinesis.naming[2], kinesis.naming[3]]);

        var dictPath =
            [svcId,
             kinesis.dn];

        var info = {
            name: kinesis.obj.StreamName,
            class: 'queue',
            subClass: 'kinesis'
        }
        this._setupNativeResourceConfig(info, kinesis.obj.StreamARN);

        this.endpointProcessor.reportNative(svcId, kinesis, info);
    }

    _deployTaskMessage(taskDn, taskId, taskMessage)
    {
        if (!this.rootProcessor.berliozAgentExternalHostPort) {
            // TODO: trigger berlioz cluster start....
            this._logger.warn('[_deployTaskMessage] skipped for %s. No agent.', taskDn);
            return;
        }

        var options = {
            method: 'POST',
            uri: 'http://' + this.rootProcessor.berliozAgentExternalHostPort + '/report',
            body: [taskMessage],
            json: true
        };

        this._logger.info('[_deployTaskMessage] reporting to %s...', options.uri, options.body);
        return request(options)
            .then(result =>  {
                this._logger.info('[_deployTaskMessage] RESPONSE:', result);
            });
    }

    _setupNativeResourceConfig(info, objectArn)
    {
        info.config = {};
        if (this.rootProcessor._awsCredentials) {
            info.config.credentials = {
                accessKeyId: this.rootProcessor._awsCredentials.key,
                secretAccessKey: this.rootProcessor._awsCredentials.secret
            }
        }

        if (objectArn) {
            var arn = arnParser(objectArn);
            info.config.region = arn.region;
        } else {
            info.config.region = this.rootProcessor.awsClient.region
        }
    }

    _breakDn(dn)
    {
        var dnInfo = this._meta.breakDn(dn);
        return {
            cluster: dnInfo.naming[0],
            sector: dnInfo.naming[1],
            service: dnInfo.naming[2],
            identity: dnInfo.naming[3]
        };
    }


}

module.exports = TaskMetadataStore;
