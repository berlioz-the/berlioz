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
        this._tableImpl = tableImpl;

        this._synchronizers = {}
        this._synchronizers["public"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "endpoints-public", tableImpl, this._scope, customEndpointHandler);
        this._synchronizers["external"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "endpoints-external", tableImpl, this._scope, customEndpointHandler);
        this._synchronizers["internal"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "endpoints-internal", tableImpl, this._scope, customEndpointHandler);
        this._synchronizers["priority-public"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "priority-endpoints-public", tableImpl, this._scope, customEndpointHandler);
        this._synchronizers["priority-external"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "priority-endpoints-external", tableImpl, this._scope, customEndpointHandler);
        this._synchronizers["priority-internal"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "priority-endpoints-internal", tableImpl, this._scope, customEndpointHandler);
        this._synchronizers["cluster-dependencies"] = new TableSynchronizer(logger.sublogger("TableSynchronizer"), "cluster-dependencies", tableImpl, this._scope);

        this._logger.info("[constructor] scope: ", this._scope);
    }

    processClusterDependencies(clusterEntity)
    {
        this._logger.info("[processClusterDependencies] %s", clusterEntity.id);

        return Promise.resolve()
            .then(() => Promise.serial(clusterEntity.services, x => this._processServiceDependencies(clusterEntity, x)))
            .then(() => {
                this._logger.info("[prefetchCluster] Final Peers: ", this._endpoints);
            })
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
            cluster: clusterEntity.name,
            dependent: dependentServiceId,
        }
        row.full_name = [row.cluster, row.dependent].join('-')

        synchronizer.add(row.full_name, row);
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
            if (location == "internal") {
                serviceId = [serviceProvided.service.id, serviceProvided.name].join('-');
            } else if (location == "external") {
                if (serviceProvided.clusterProvided != null) {
                    serviceId = [serviceProvided.clusterProvided.cluster.id, serviceProvided.clusterProvided.name].join('-');
                }
            } else if (location == "public") {
                if (serviceProvided.clusterProvided != null) {
                    if (serviceProvided.clusterProvided.isPublic) {
                        serviceId = [serviceProvided.clusterProvided.cluster.id, serviceProvided.clusterProvided.name].join('-');
                    }
                }
            }

            if (serviceId != null) {
                this._processEndpoint("priority-" + location, serviceId, identity, info);
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
        this._processEndpoint("external", serviceId, identity, endpointInfo);
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

        var full_name = serviceId + "-" + identity;
        var row = {
            full_name: full_name,
            service: serviceId,
            identity: identity,
            info: endpointInfo
        }
        synchronizer.add(full_name, row);
    }

    finish()
    {
        this._logger.info("[finish]");
        return Promise.serial(_.values(this._synchronizers), x => x.sync())
    }

}

module.exports = EndpointProcessor;