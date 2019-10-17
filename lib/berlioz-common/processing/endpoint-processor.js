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
            // .then(() => Promise.serial(serviceEntity.databasesConsumes, x => this._processNativeDependency(clusterEntity, x)))
            // .then(() => Promise.serial(serviceEntity.queuesConsumes, x => this._processNativeDependency(clusterEntity, x)))
    }
    
    _processEndpointDependency(clusterEntity, consumedEndpoint)
    {
        this._logger.info("[_processEndpointDependency] %s", consumedEndpoint.id);
        
        var dependentServiceId = [consumedEndpoint.targetId, consumedEndpoint.targetEndpoint].join('-');
        this._registerDependent(clusterEntity, dependentServiceId);
    }

    // _processNativeDependency(clusterEntity, consumedNative)
    // {
    //     this._logger.info("[_processNativeDependency] %s", consumedNative.id);

    //     var dependentServiceId = [consumedNative.targetId].join('-');
    //     this._registerDependent(clusterEntity, dependentServiceId);
    // }
    
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
        this._logger.info("[reportOverriddenEndpoints] %s", clusterEntity.id);

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

    reportNative(entityId, obj, endpointInfo)
    {
        this._logger.info("[reportNative] svc: %s, task: %s, info:", entityId, obj.dn, endpointInfo);

        var serviceId = [entityId].join('-');
        var identity = "0";
        this._processEndpoint("internal", serviceId, identity, endpointInfo);
    }

    _processEndpoint(syncName, serviceId, identity, endpointInfo)
    {
        this._logger.info("[_processEndpoint] %s => serviceId: %s, identity: %s, info:", syncName, serviceId, identity, endpointInfo);

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

    // NEW
    reportInternalEndpoint(serviceId, identity, endpointInfo)
    {
        return this._reportEndpoint("final-internal", serviceId, identity, endpointInfo);
    }

    // NEW
    reportPublicEndpoint(serviceId, identity, endpointInfo)
    {
        return this._reportEndpoint("final-public", serviceId, identity, endpointInfo);
    }

    _reportEndpoint(kind, serviceId, identity, endpointInfo)
    {
        this._logger.info("[_reportEndpoint] %s. %s :: %s, info:", kind, serviceId, identity, endpointInfo);

        var synchronizer = this._synchronizers[kind];

        var row = {
            service: serviceId,
            identity: identity,
            info: endpointInfo
        }
        row.full_name = [this._namingPrefix, row.service, identity].join('-')

        synchronizer.add(row.full_name, row);
    }

    finish()
    {
        this._logger.info("[finish]");
        return Promise.serial(_.values(this._synchronizers), x => x.sync())
    }

}

module.exports = EndpointProcessor;