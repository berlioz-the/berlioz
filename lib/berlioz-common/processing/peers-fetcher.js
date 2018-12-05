const Promise = require("the-promise");
const _ = require("the-lodash");
const TableFetcher = require("./table-fetcher");

class PeersFetcher
{
    constructor(logger, tableImpl, scope)
    {
        this._tables = {};
        this._logger = logger;
        this._rootScope = scope;

        this._logger.info("[constructor] root scope: ", this._rootScope);

        this._fetchers = {}
        this._fetchers["public"] = new TableFetcher(logger.sublogger("TableFetcher"), "final_endpoints_public", tableImpl);
        this._fetchers["internal"] = new TableFetcher(logger.sublogger("TableFetcher"), "final_endpoints_internal", tableImpl);
        this._fetchers["consumer-meta"] = new TableFetcher(logger.sublogger("TableFetcher"), "consumer_meta", tableImpl);
        this._fetchers["provider-meta"] = new TableFetcher(logger.sublogger("TableFetcher"), "provider_meta", tableImpl);

        this._endpoints = {};
        this._consumerMetas = {};
        this._providerMetas = {};
    }

    prefetchClusterDependencies(clusterEntity)
    {
        this._logger.info("[prefetchClusterDependencies] %s", clusterEntity.id);

        return Promise.resolve()
            .then(() => this._prefetchProviderMetas(clusterEntity))
            .then(() => Promise.serial(clusterEntity.services, x => this._prefetchServiceDependencies(x)))
            .then(() => {
                this._logger.info("[prefetchClusterDependencies] Peers: ", this._endpoints);
                this._logger.info("[prefetchClusterDependencies] Consumer Metas: ", this._consumerMetas);
                this._logger.info("[prefetchClusterDependencies] Provider Metas: ", this._providerMetas);
                // this._logger.info("[prefetchClusterDependencies] VPC Connections: ", this.getVpcConnections());
                
            })
    }

    prefetchClusterPublicEndpoints(clusterEntity)
    {
        this._logger.info("[prefetchClusterPublicEndpoints] %s", clusterEntity.id);

        var scope = {cluster: clusterEntity.name};
        return this._prefetchService('public', scope);
    }

    prefetchClusterPublicProvides(clusterProvided)
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
            .then(() => Promise.serial(_.values(serviceEntity.provides), x => this._prefetchServiceProvided(x)))
            .then(() => Promise.serial(serviceEntity.consumes, x => this._prefetchConsumedEndpoint(x)))
            .then(() => Promise.serial(serviceEntity.databasesConsumes, x => this._prefetchConsumedNative(x)))
            .then(() => Promise.serial(serviceEntity.queuesConsumes, x => this._prefetchConsumedNative(x)))
    }

    getServiceProvidedConsumerMetas(serviceProvided)
    {
        this._logger.info("[getServiceProvidedConsumerMetas] %s ... ", serviceProvided.id);

        if (serviceProvided.id in this._consumerMetas) {
            return this._consumerMetas[serviceProvided.id];
        }

        return [];
    }

    _prefetchProviderMetas(clusterEntity)
    {
        this._logger.info("[_prefetchProviderMetas] %s ...", clusterEntity.id);
        
        var info;
        if (this._rootScope) {
            info = _.clone(this._rootScope);
            info.consumerRegion = this._rootScope.region;
            delete info.region;
        } else {
            info = {};
        }
        info.consumerCluster = clusterEntity.name;

        this._logger.info("[_prefetchProviderMetas] %s :: ", clusterEntity.id, info);

        return Promise.resolve()
            .then(() => {
                return this._fetchers["provider-meta"].query(info);
            })
            .then(results => {
                for(var x of _.keys(results)) {
                    this._providerMetas[x] = results[x]; 
                }
            });
    }

    _prefetchServiceProvided(serviceProvided)
    {
        this._logger.info("[_prefetchServiceProvided] %s", serviceProvided.id);

        var info = {
            providerCluster: serviceProvided.service.clusterName,
            providerService: serviceProvided.service.id,
            providerEndpoint: serviceProvided.name,
        }

        return Promise.resolve()
            .then(() => this._prefetchConsumerMeta(serviceProvided, info))
            .then(() => {
                var clusterProvided = serviceProvided.clusterProvided;
                if (clusterProvided) {
                    var clusterProvInfo = {
                        providerCluster: clusterProvided.cluster.name,
                        providerService: clusterProvided.cluster.id,
                        providerEndpoint: clusterProvided.name,
                    }
                    return this._prefetchConsumerMeta(serviceProvided, clusterProvInfo)
                }
            })
            // .then(() => {
            //     var consumers = this._consumerMetas[serviceProvided.id];
            //     consumers = _.uniqBy(consumers, _.stableStringify);
            //     this._consumerMetas[serviceProvided.id] = consumers;
            // });
    }

    _prefetchConsumerMeta(providerEntity, info)
    {
        if (this._rootScope) {
            info = _.defaults(info, this._rootScope);
        }

        this._logger.info("[_prefetchConsumerMeta] ", info);

        return Promise.resolve()
            .then(() => {
                return this._fetchers["consumer-meta"].query(info);
            })
            .then(result => {
                this._logger.info("[_prefetchConsumerMeta] result:", result);
                var consumers = [];
                if (result) {
                    consumers = _.values(result);
                    // consumers = consumers.map(x => x.info);
                }
                if (providerEntity.id in this._consumerMetas) {
                    consumers = _.concat(this._consumerMetas[providerEntity.id], consumers);
                }
                this._consumerMetas[providerEntity.id] = consumers;
            })
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
            return this._prefetchService('internal', scope);
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
        var actualScope = _.clone(scope);
        if (this._rootScope) {
            actualScope = _.defaults(actualScope, this._rootScope);
        }

        this._logger.info("[_prefetchService] %s :: ", location, actualScope);

        return Promise.resolve()
            .then(() => {
                return this._fetchers[location].query(actualScope);
            })
            .then(result => {
                this._logger.info("[_prefetchService] peers result:", result);
                if (!result) {
                    return;
                }
                for(var peer of _.values(result)) {
                    if (!(this._endpoints[peer.service])) {
                        this._endpoints[peer.service] = [];
                    }
                    this._endpoints[peer.service].push(peer);
                }
            })
    }

    getMyPeers(serviceEntity)
    {
        this._logger.info("[getMyPeers] %s ... ", serviceEntity.id);

        var myPeerData = {};
        for (var consumed of serviceEntity.consumes)
        {
            this._fillProvidedEndpointData(myPeerData, consumed);
        }
        for (var consumed of serviceEntity.databasesConsumes)
        {
            this._fillConsumedNativeEndpoint(myPeerData, consumed);
        }
        for (var consumed of serviceEntity.queuesConsumes)
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

    getVpcConnections()
    {
        return _(this._providerMetas)
            .values()
            .map(x => x.info.vpcConnection)
            .uniq()
            .value();
    }

    getServiceVpcConnections(serviceEntity)
    {
        return _(this._providerMetas)
            .values()
            .filter(x => x.consumerService == serviceEntity.id)
            .map(x => x.info)
            .uniq()
            .value();
    }

    _fillProvidedEndpointData(myPeerData, consumedEndpoint)
    {
        var serviceId = [consumedEndpoint.targetId, consumedEndpoint.targetEndpoint].join("-");
        var peers;
        if (serviceId in this._endpoints) {
            peers = this._endpoints[serviceId];
        } else {
            peers = [];
        }
        myPeerData[serviceId] = _.makeDict(peers, x => x.identity, x => x.info);
    }

    _fillConsumedNativeEndpoint(myPeerData, consumedNative)
    {
        this._logger.info("[_fillConsumedNativeEndpoint] %s ... ", consumedNative.id);

        var serviceId = [consumedNative.targetId].join("-");
        var peers;
        if (serviceId in this._endpoints) {
            peers = this._endpoints[serviceId];
        } else {
            peers = [];
        }
        myPeerData[serviceId] = _.makeDict(peers, x => x.identity, x => x.info);
    }
}

module.exports = PeersFetcher;