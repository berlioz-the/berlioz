const Promise = require("the-promise");
const _ = require("the-lodash");
const TableSynchronizer = require("./table-synchronizer");

class MetadataProcessor
{
    constructor(logger, tableImpl, scope)
    {
        this._tables = {};
        this._logger = logger;
        this._tableImpl = tableImpl;
        this._scope = scope;

        this._serviceSubscriberFilters = {};

        this._synchronizers = {};

        this._setupSynchronizer('meta');
        this._setupSynchronizer('subscriber');

        this._logger.info("[constructor] scope: ", this._scope);
    }

    start(clusterEntity)
    {
        return Promise.resolve()
            .then(() => this.reportClusterEntity(clusterEntity))
            .then(() => Promise.serial(clusterEntity.services, x => this.reportServiceMetaSubcribers(x)))
            .then(() => this.syncSubscribers(clusterEntity))
    }
    
    finish()
    {
        this._logger.info("[finish]");
        return this._getSynchronizer('meta').sync();
    }
    
    reportClusterEntity(clusterEntity)
    {
        this._logger.info("[reportClusterEntity] %s...", clusterEntity.id);

        var clusterMetadata = clusterEntity.buildMetadata();
        this._addRow('meta', null, clusterMetadata);
    }

    reportServiceMetaSubcribers(serviceEntity)
    {
        var subscriberFilters = [];
        for (var consumed of serviceEntity.metaConsumes)
        {
            var subscriberFilter = {
                targetKind: 'meta',
                targetRegion: this._scope.region
            } 
            if (consumed.definition.cluster) {
                subscriberFilter.targetCluster = consumed.definition.cluster;
            }
            subscriberFilters.push(subscriberFilter);
            this._addRow('subscriber', subscriberFilter, consumed.definition);
        }
        this._serviceSubscriberFilters[serviceEntity.id] = subscriberFilters;
    }

    syncSubscribers()
    {
        this._logger.info("[syncSubscribers]");
        return this._getSynchronizer('subscriber').sync();
    }

    _getSynchronizer(kind)
    {
        if (kind in this._synchronizers) {
            return this._synchronizers[kind];
        }
        throw new Error("Invalid synchronizer: " + kind);
    }

    collectServiceConsumedMeta(serviceEntity)
    {
        this._logger.info("[collectServiceConsumedMeta] %s...", serviceEntity.id);

        if (!(serviceEntity.id in this._serviceSubscriberFilters)) 
        {
            throw new Error("MetadataProcessor. reportServiceMetaSubcribers should have been called before collectServiceMetaConsumes");
        }
        var subscriberFilters = this._serviceSubscriberFilters[serviceEntity.id];

        return Promise.resolve()
            .then(() => this._querySubscribedMetas(subscriberFilters))
            .then(results => {
                this._logger.verbose("[collectServiceConsumedMeta] %s results: ", serviceEntity.id, results);

                var metaConsumes = this._getMetaConsumes(serviceEntity, results);
                var normalConsumes = this._getNormalConsumes(serviceEntity);

                var finalServiceConsumedMeta = _.concat(normalConsumes, metaConsumes);
                this._logger.info("[collectServiceConsumedMeta] %s finalServiceConsumedMeta: ", serviceEntity.id, finalServiceConsumedMeta);
                return finalServiceConsumedMeta;
            });
    }
    
    _setupSynchronizer(kind)
    {
        var scope = _.clone(this._scope);
        scope.kind = kind;
        this._synchronizers[kind] = new TableSynchronizer(this._logger.sublogger("TableSynchronizer"), "deployment_metadata", this._tableImpl, scope);
    }

    _getMetaConsumes(serviceEntity, results)
    {
        var myMetaConsumes = this._getMyClusterMetaConsumes(serviceEntity);
        var otherMetaConsumes = this._getOtherClusterMetaConsumes(serviceEntity, results);

        var finalMetaConsumes = _.concat(myMetaConsumes, otherMetaConsumes);
        for(var x of finalMetaConsumes)
        {
            x.meta = true;
        }
        
        finalMetaConsumes = _.orderBy(finalMetaConsumes, x => x.id);
        return finalMetaConsumes;
    }

    _getMyClusterMetaConsumes(serviceEntity)
    {
        if (serviceEntity.metaConsumes.length == 0) {
            return [];
        }

        var queryAllClusters = false;
        var clustersToFilter = {}
        for (var consumed of serviceEntity.metaConsumes)
        {
            if (consumed.definition.cluster) {
                clustersToFilter[consumed.definition.cluster] = true;
            } else {
                queryAllClusters = true;
            }
        }

        var myClusterMetadata = serviceEntity.cluster.buildMetadata();
        this._logger.silly("[_getMyClusterMetaConsumes] %s , myClusterMetadata: ", serviceEntity.id, myClusterMetadata);
        if (!queryAllClusters) {
            myClusterMetadata = myClusterMetadata.filter(x => clustersToFilter[x.cluster]);
        }
        this._logger.silly("[_getMyClusterMetaConsumes] %s , myClusterMetadata: ", serviceEntity.id, myClusterMetadata);
        return myClusterMetadata;
    }

    _getOtherClusterMetaConsumes(serviceEntity, results)
    {
        var metaConsumedDict = {};
        for(var subcribedItem of results)
        {
            for(var x of subcribedItem.data)
            {
                // TODO: FILTER OUT MY CLUSTER. See if this can go away
                if (x.cluster != this._scope.cluster) {
                    metaConsumedDict[x.id] = x;
                }
            }
        }
        this._logger.verbose("[_getOtherClusterMetaConsumes] %s MetaConsumedDict: ", serviceEntity.id, metaConsumedDict);

        return _.values(metaConsumedDict);
    }

    _getNormalConsumes(serviceEntity)
    {
        var serviceConsumesMeta = serviceEntity.buildConsumedMeta();
        return serviceConsumesMeta;
    }

    finish()
    {
        return this._synchronizers['meta'].sync();
    }

    _querySubscribedMetas(subscriberFilters)
    {
        this._logger.info("[_querySubscribedMetas] subscribers:", subscriberFilters);

        return Promise.serial(subscriberFilters, x => this._querySubscribedMeta(x))
            .then(results => {
                this._logger.silly("[_querySubscribedMetas] results:", results);
                var mergedResult = _.defaults.apply(null, results);
                this._logger.verbose("[_querySubscribedMetas] mergedResult:", mergedResult);
                return _.values(mergedResult);
            });
    }

    _querySubscribedMeta(subscriberFilter)
    {
        var queryFilter = {
            kind: subscriberFilter.targetKind,
            region: subscriberFilter.targetRegion
        }
        if (subscriberFilter.cluster) {
            queryFilter.cluster = subscriberFilter.cluster;
        }
        if (this._scope.deployment) {
            queryFilter.deployment = this._scope.deployment;
        }
        return this._getSynchronizer('meta').rawQuery(queryFilter);
    }

    _addRow(kind, filters, data)
    {
        var row = {
            kind: kind,
            data: data
        }

        var newFilters = _.clone(this._scope);
        if (filters) {
            newFilters = _.defaults(newFilters, filters);
        }
 
        row = _.defaults(row, newFilters);

        var parts = [row.kind];
        var keys = _.keys(newFilters);
        keys = _.sortBy(keys);
        for(var f of keys) {
            var val = newFilters[f];
            if (val) {
                parts.push(f);
                parts.push(val);
            }
        }
        row.full_name = parts.join('-');

        this._getSynchronizer(row.kind).add(row.full_name, row);
    }


}

module.exports = MetadataProcessor;