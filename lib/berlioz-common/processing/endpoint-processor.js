const Promise = require("the-promise");
const _ = require("the-lodash");
const TableSynchronizer = require("./table-synchronizer");

class EndpointProcessor
{
    constructor(logger, tableImpl, scope, customEndpointHandler)
    {
        this._tables = {};
        this._logger = logger;
        this._scope = scope;
        this._namingPrefix = "";

        this._synchronizers = {}
        this._synchronizers["public"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "endpoints_public", tableImpl, this._scope);
        this._synchronizers["internal"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "endpoints_internal", tableImpl, this._scope);
        this._synchronizers["priority-public"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "priority_endpoints_public", tableImpl, this._scope);
        this._synchronizers["priority-internal"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "priority_endpoints_internal", tableImpl, this._scope);
        this._synchronizers["final-public"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "final_endpoints_public", tableImpl, this._scope, customEndpointHandler);
        this._synchronizers["final-internal"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "final_endpoints_internal", tableImpl, this._scope, customEndpointHandler);
        this._synchronizers["cluster-dependencies"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "cluster_dependencies", tableImpl, this._scope);
        this._synchronizers["consumer-meta"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "consumer_meta", tableImpl, this._scope);
        this._synchronizers["provider-meta"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "provider_meta", tableImpl, this._scope);

        this._endpoints = {
            "public": {},
            "internal": {},
            "priority-public": {},
            "priority-internal": {}
        }

        this._logger.info("[constructor] scope: ", this._scope);
    }

    namingPrefix(value) {
        this._namingPrefix = value;
    }

    processClusterDependencies(clusterEntity)
    {
        this._logger.info("[processClusterDependencies] %s", clusterEntity.id);

        return Promise.resolve()
            .then(() => Promise.serial(clusterEntity.services, x => this._processServiceDependencies(clusterEntity, x)));
    }

    _processServiceDependencies(clusterEntity, serviceEntity)
    {
        this._logger.info("[_processServiceDependencies] %s", serviceEntity.id);

        return Promise.resolve()
            .then(() => Promise.serial(serviceEntity.consumes, x => this._processEndpointDependency(clusterEntity, x)))
            .then(() => Promise.serial(serviceEntity.databasesConsumes, x => this._processNativeDependency(clusterEntity, x)))
            .then(() => Promise.serial(serviceEntity.queuesConsumes, x => this._processNativeDependency(clusterEntity, x)))
    }
    
    _processEndpointDependency(clusterEntity, consumedEndpoint)
    {
        this._logger.info("[_processEndpointDependency] %s", consumedEndpoint.id);
        
        var dependentServiceId = [consumedEndpoint.targetId, consumedEndpoint.targetEndpoint].join('-');
        this._registerDependent(clusterEntity, dependentServiceId);
    }

    _processNativeDependency(clusterEntity, consumedNative)
    {
        this._logger.info("[_processNativeDependency] %s", consumedNative.id);

        var dependentServiceId = [consumedNative.targetId].join('-');
        this._registerDependent(clusterEntity, dependentServiceId);
    }
    
    _registerDependent(clusterEntity, dependentServiceId)
    {
        this._logger.info("[_registerDependent] %s => %s...", clusterEntity.id, dependentServiceId);

        var synchronizer = this._synchronizers["cluster-dependencies"];

        var row = {
            dependent: dependentServiceId,
        }
        row.full_name = [this._namingPrefix, row.dependent].join('-')

        synchronizer.add(row.full_name, row);
    }

    reportOverriddenEndpoints(clusterEntity)
    {
        this._logger.info("[processClusterDependencies] %s", clusterEntity.id);

        return Promise.resolve()
            .then(() => Promise.serial(clusterEntity.services, x => this._reportServiceOverriddenEndpoints(x)));
    }

    _reportServiceOverriddenEndpoints(serviceEntity)
    {
        this._logger.info("[_reportServiceOverriddenEndpoints] %s", serviceEntity.id);

        for (var provided of _.values(serviceEntity.provides))
        {
            this._reportServiceProvidedOverriddenEndpoints(provided);
        }
    }

    _reportServiceProvidedOverriddenEndpoints(serviceProvided)
    {
        if (!serviceProvided.shouldOverride) {
            return;
        }
       
        var serviceId = [serviceProvided.service.id, serviceProvided.name].join('-');
        var clusterProvided = serviceProvided.clusterProvided;
        var clusterId;
        if (clusterProvided) {
            clusterId = [clusterProvided.cluster.id, clusterProvided.name].join('-');
        }

        var peers = serviceProvided.overriddenPeers;
        for (var i = 0; i < peers.length; i++) {
            var peer = peers[i];
            var identity = (i+1);

            this._processEndpoint("internal", serviceId, identity, peer);

            if (clusterProvided) {
                this._processEndpoint("internal", clusterId, identity, peer);

                if (clusterProvided.isPublic) {
                    this._processEndpoint("public", clusterId, identity, peer);
                }
            }
        }
    }

    reportTask(serviceEntity, task, endpointInfo)
    {
        this._logger.info("[reportTask] svc: %s, task: %s, info:", serviceEntity.id, task.dn, endpointInfo);

        for (var provided of _.values(serviceEntity.provides))
        {
            this._processProvided(provided, task, endpointInfo);
        }
    }

    reportLoadBalancer(serviceProvided, endpointInfo)
    {
        this._logger.info("[reportLoadBalancer] provided: %s, info:", serviceProvided.id, endpointInfo);

        var identity = "0";
        for (var location of _.keys(endpointInfo))
        {
            this._logger.info("[reportLoadBalancer] provided: %s, location: %s", serviceProvided.id, location);

            var serviceId = null;
            var info = endpointInfo[location];
            var tableName;
            if (location == "internal") {
                serviceId = [serviceProvided.service.id, serviceProvided.name].join('-');
                tableName = "priority-internal";
            } else if (location == "external") {
                if (serviceProvided.clusterProvided != null) {
                    serviceId = [serviceProvided.clusterProvided.cluster.id, serviceProvided.clusterProvided.name].join('-');
                    tableName = "priority-internal";
                }
            } else if (location == "public") {
                if (serviceProvided.clusterProvided != null) {
                    if (serviceProvided.clusterProvided.isPublic) {
                        serviceId = [serviceProvided.clusterProvided.cluster.id, serviceProvided.clusterProvided.name].join('-');
                        tableName = "priority-public";
                    }
                }
            }

            if (serviceId != null) {
                this._processEndpoint(tableName, serviceId, identity, info);
            }
        }
    }

    reportNative(entityId, obj, endpointInfo)
    {
        this._logger.info("[reportNative] svc: %s, task: %s, info:", entityId, obj.dn, endpointInfo);

        var serviceId = [entityId].join('-');
        var identity = "0";
        this._processEndpoint("internal", serviceId, identity, endpointInfo);
    }

    _processProvided(serviceProvided, task, endpointInfo)
    {
        if (serviceProvided.shouldOverride) {
            return;
        }

        this._processInternal(serviceProvided, task, endpointInfo.internal[serviceProvided.name]);

        if (serviceProvided.clusterProvided) {
            this._processExternal(serviceProvided.clusterProvided, task, endpointInfo.external[serviceProvided.name]);

            if (serviceProvided.clusterProvided.isPublic) {
                this._processPublic(serviceProvided.clusterProvided, task, endpointInfo.public[serviceProvided.name]);
            }
        }
    }

    _processInternal(serviceProvided, task, endpointInfo)
    {
        this._logger.info("[_processInternal] provided: %s, task: %s, info:", serviceProvided.id, task.dn, endpointInfo);

        var serviceId = [serviceProvided.service.id, serviceProvided.name].join('-');
        var identity = _.last(task.naming);
        this._processEndpoint("internal", serviceId, identity, endpointInfo);
    }

    _processExternal(clusterProvided, task, endpointInfo)
    {
        this._logger.info("[_processExternal] provided: %s, task: %s, info:", clusterProvided.id, task.dn, endpointInfo);

        var serviceId = [clusterProvided.cluster.id, clusterProvided.name].join('-');
        var identity = _.last(task.naming);
        this._processEndpoint("internal", serviceId, identity, endpointInfo);
    }

    _processPublic(clusterProvided, task, endpointInfo)
    {
        this._logger.info("[_processPublic] provided: %s, task: %s, info:", clusterProvided.id, task.dn, endpointInfo);

        var serviceId = [clusterProvided.cluster.id, clusterProvided.name].join('-');
        var identity = _.last(task.naming);
        this._processEndpoint("public", serviceId, identity, endpointInfo);
    }

    _processEndpoint(syncName, serviceId, identity, endpointInfo)
    {
        this._logger.info("[_processPublic] %s => serviceId: %s, identity: %s, info:", syncName, serviceId, identity, endpointInfo);

        var synchronizer = this._synchronizers[syncName];

        var row = {
            service: serviceId,
            identity: identity,
            info: endpointInfo
        }
        row.full_name = [this._namingPrefix, row.service, row.identity].join('-')

        synchronizer.add(row.full_name, row);

        if (!(serviceId in this._endpoints[syncName])) {
            this._endpoints[syncName][serviceId] = {};    
        }
        this._endpoints[syncName][serviceId][identity] = endpointInfo;
    }

    prepareFinal(clusterEntity)
    {
        this._logger.info("[prepareFinal] %s", clusterEntity.id);

        return Promise.resolve()
            .then(() => Promise.serial(clusterEntity.services, x => this._prepareFinalService(x)))
            .then(() => Promise.serial(_.values(clusterEntity.provides), x => this._prepareFinalClusterProvided(x)))
            .then(() => Promise.serial(clusterEntity.databases, x => this._prepareFinalNativeService(x)))
            .then(() => Promise.serial(clusterEntity.queues, x => this._prepareFinalNativeService(x)))
            ;
    }

    _prepareFinalService(serviceEntity)
    {
        this._logger.info("[_prepareFinalService] %s", serviceEntity.id);

        return Promise.serial(_.values(serviceEntity.provides), x => this._prepareFinalServiceProvided(x));
    }

    _prepareFinalClusterProvided(clusterProvided)
    {
        this._logger.info("[_prepareFinalClusterProvided] %s", clusterProvided.id);

        this._prepareService("internal", clusterProvided.cluster.id, clusterProvided.name);

        if (clusterProvided.isPublic) {
            this._prepareService("public", clusterProvided.cluster.id, clusterProvided.name);
        }
    }

    _prepareFinalServiceProvided(serviceProvided)
    {
        this._logger.info("[_prepareFinalServiceProvided] %s", serviceProvided.id);
        this._prepareService("internal", serviceProvided.service.id, serviceProvided.name);
    }

    _prepareFinalNativeService(nativeService)
    {
        this._logger.info("[_prepareFinalNativeService] %s", nativeService.id);
        this._prepareService("internal", nativeService.id, null)
    }

    _prepareService(name, providerId, endpointName)
    {
        var parts = [providerId, endpointName];
        parts = parts.filter(x => _.isNotNullOrUndefined(x));
        var serviceId = parts.join('-');

        var endpoints = {};
        var priorityName = "priority-" + name;
        if (serviceId in this._endpoints[priorityName]) {
            endpoints = this._endpoints[priorityName][serviceId];
        }
        if (_.keys(endpoints).length == 0) {
            if (serviceId in this._endpoints[name]) {
                endpoints = this._endpoints[name][serviceId];
            }
        }
        this._logger.info("[_prepareService] %s => ", serviceId, endpoints);

        var synchronizer = this._synchronizers["final-" + name];
        for(var identity of _.keys(endpoints))
        {
            var row = {
                provider: providerId,
                service: serviceId,
                identity: identity,
                info: endpoints[identity]
            }
            if (endpointName) {
                row.endpoint = endpointName;
            }
            row.full_name = [this._namingPrefix, row.service, row.identity].join('-');
            synchronizer.add(row.full_name, row);
        }
    }

    registerConsumerMeta(consumerEntity, consumerInfo)
    {
        this._logger.info("[registerConsumerMeta] %s => %s...", consumerEntity.id, consumerInfo);

        var synchronizer = this._synchronizers["consumer-meta"];

        var row = {
            service: consumerEntity.service.id,
            providerCluster: consumerEntity.targetNaming[0],
            providerService: consumerEntity.targetId,
            providerEndpoint: consumerEntity.targetEndpoint,
            info: consumerInfo
        }
        row.full_name = [this._namingPrefix, row.service, row.providerService, row.providerService].join('-')

        synchronizer.add(row.full_name, row);
    }

    registerProviderMeta(provider, consumer, providerInfo)
    {
        this._logger.info("[registerProviderMeta] %s :: ", provider, consumer, providerInfo);

        var synchronizer = this._synchronizers["provider-meta"];

        var row = {
            service: provider.id,
            consumerCluster: consumer.cluster,
            consumerRegion: consumer.region,
            consumerService: consumer.service,
            info: providerInfo
        }
        row.full_name = [this._namingPrefix, row.service, row.consumerCluster, row.consumerRegion, row.consumerService].join('-')

        synchronizer.add(row.full_name, row);
    }

    finish()
    {
        this._logger.info("[finish]");
        return Promise.serial(_.values(this._synchronizers), x => x.sync())
    }

}

module.exports = EndpointProcessor;