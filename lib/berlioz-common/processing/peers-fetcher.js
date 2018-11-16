const Promise = require("the-promise");
const _ = require("the-lodash");
const TableFetcher = require("./table-fetcher");

class PeersFetcher
{
    constructor(logger, tableImpl)
    {
        this._tables = {};
        this._logger = logger;

        this._fetchers = {}
        this._fetchers["public"] = new TableFetcher(logger.sublogger("TableFetcher"), "endpoints-public", tableImpl);
        this._fetchers["external"] = new TableFetcher(logger.sublogger("TableFetcher"), "endpoints-external", tableImpl);
        this._fetchers["internal"] = new TableFetcher(logger.sublogger("TableFetcher"), "endpoints-internal", tableImpl);
        this._fetchers["priority-public"] = new TableFetcher(logger.sublogger("TableFetcher"), "priority-endpoints-public", tableImpl);
        this._fetchers["priority-external"] = new TableFetcher(logger.sublogger("TableFetcher"), "priority-endpoints-external", tableImpl);
        this._fetchers["priority-internal"] = new TableFetcher(logger.sublogger("TableFetcher"), "priority-endpoints-internal", tableImpl);

        this._endpoints = {};

        this._logger.info("[constructor] ");
    }

    prefetchClusterDependencies(clusterEntity)
    {
        this._logger.info("[prefetchClusterDependencies] %s", clusterEntity.id);

        return Promise.resolve()
            .then(() => Promise.serial(clusterEntity.services, x => this._prefetchServiceDependencies(x)))
            .then(() => {
                this._logger.info("[prefetchCluster] Final Peers: ", this._endpoints);
            })
    }

    prefetchClusterPublicEndpoints(clusterEntity)
    {
        this._logger.info("[prefetchClusterPublicEndpoints] %s", clusterEntity.id);

        return Promise.resolve()
            .then(() => Promise.serial(_.values(clusterEntity.provides), x => this._prefetchClusterProvides(x)))
            .then(() => {
                this._logger.info("[prefetchCluster] Final Peers: ", this._endpoints);
            })
    }

    _prefetchClusterProvides(clusterProvided)
    {
        this._logger.info("[_prefetchClusterProvides] %s", clusterProvided.id);

        var serviceId = [clusterProvided.cluster.id, clusterProvided.name].join('-');
        var scope = {service: serviceId};
        return this._prefetchService('public', scope);
    }

    _prefetchServiceDependencies(serviceEntity)
    {
        this._logger.info("[_prefetchServiceDependencies] %s", serviceEntity.id);

        return Promise.resolve()
            .then(() => Promise.serial(serviceEntity.consumes, x => this._prefetchConsumedEndpoint(x)))
            .then(() => Promise.serial(serviceEntity.databasesConsumes, x => this._prefetchConsumedNative(x)))
            .then(() => Promise.serial(serviceEntity.queuesConsumes, x => this._prefetchConsumedNative(x)))
    }

    _prefetchConsumedEndpoint(consumedEndpoint)
    {
        this._logger.info("[_prefetchConsumedEndpoint] %s", consumedEndpoint.id);

        var serviceId = [consumedEndpoint.targetId, consumedEndpoint.targetEndpoint].join('-');
        var scope = {service: serviceId};
        if (consumedEndpoint.targetKind == 'service') {
            return this._prefetchService('internal', scope);
        } 
        if (consumedEndpoint.targetKind == 'cluster') {
            return this._prefetchService('external', scope);
        }
    }

    _prefetchConsumedNative(consumedNative)
    {
        this._logger.info("[_prefetchConsumedNative] %s", consumedNative.id);

        var serviceId = [consumedNative.targetId].join('-');
        var scope = {service: serviceId};
        return this._prefetchService('internal', scope);
    }

    _prefetchService(location, scope)
    {
        this._logger.info("[_prefetchService] %s :: ", location, scope);

        return Promise.resolve()
            .then(() => {
                return this._fetchers["priority-" + location].query(scope);
            })
            .then(result => {
                this._logger.info("[_prefetchService] priority result:", result);
                if (_.keys(result).length > 0) {
                    return result;
                } else {
                    return this._prefetchAllServicePeers(location, scope)
                }
            })
            .then(result => {
                this._logger.info("[_prefetchService] all peers result:", result);
                this._endpoints[scope.service] = _.values(result);
            })
    }

    _prefetchAllServicePeers(location, scope)
    {
        this._logger.info("[_prefetchAllServicePeers] %s :: ", location, scope);

        return Promise.resolve()
            .then(() => {
                return this._fetchers[location].query(scope);
            })
    }

    getMyPeers(serviceEntity)
    {
        var myPeerData = {};
        for (var consumed of _.values(serviceEntity.consumes))
        {
            this._fillProvidedEndpointData(myPeerData, consumed);
        }
        for (var consumed of _.values(serviceEntity.databasesConsumes))
        {
            this._fillConsumedNativeEndpoint(myPeerData, consumed);
        }
        for (var consumed of _.values(serviceEntity.queuesConsumes))
        {
            this._fillConsumedNativeEndpoint(myPeerData, consumed);
        }
        return myPeerData;
    }

    getClusterPublicEndpoints(clusterProvided)
    {
        var serviceId = [clusterProvided.cluster.id, clusterProvided.name].join('-');
        if (!(serviceId in this._endpoints)) {
            return {};
        }
        var endpoints = this._endpoints[serviceId];
        return _.makeDict(endpoints, x => x.identity, x => x.info);
    }

    _fillProvidedEndpointData(myPeerData, consumedEndpoint)
    {
        var serviceId = [consumedEndpoint.targetId, consumedEndpoint.targetEndpoint].join("-");
        if (!(serviceId in this._endpoints)) {
            return;
        }
        var endpoints = this._endpoints[serviceId];
        myPeerData[serviceId] = _.makeDict(endpoints, x => x.identity, x => x.info);
    }

    _fillConsumedNativeEndpoint(myPeerData, consumedNative)
    {
        var serviceId = [consumedNative.targetId].join("-");
        if (!(serviceId in this._endpoints)) {
            return;
        }

        var peers = this._endpoints[serviceId];
        myPeerData[serviceId] = _.makeDict(peers, x => x.identity, x => x.info);
    }
}

module.exports = PeersFetcher;