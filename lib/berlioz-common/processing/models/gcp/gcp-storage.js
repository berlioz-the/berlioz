module.exports = (section, logger, {Promise, _, helper, gcp, gcpProjectNumber, deployment, cluster, shortSourceRegion}) => {
    section
        .onQueryAll(() => {
            return gcp.Storage.queryAllBuckets(getPrefix());
        })
        .onExtractNaming(obj => getNaming(obj))
        .onExtractId(obj => obj.id)
        .onQuery(id => gcp.Storage.queryBucket(id))
        .onExtractConfig(obj => { 
            return {
                config: obj
            };
        })
        .markUseDefaultsForDelta()
        .onCreate(delta => {
            var name = delta.naming.join('_');
            return gcp.Storage.createBucket(name, delta.config.config);
        })
        .onUpdateRecreate(delta => {
            if ('location' in delta.delta.configs) {
                return true;
            }
            if ('storageClass' in delta.delta.configs) {
                return true;
            }
            // TODO: temporary
            // return false;
            return true;
        })
        // .onUpdate(delta => {
        // })
        .onDelete(delta => {
            return Promise.resolve()
                .then(() => gcp.Storage.emptyBucket(delta.id))
                .then(() => gcp.Storage.deleteBucket(delta.id));
        })
        ;

    function getPrefixParts()
    {
        var prefixParts = [
            gcpProjectNumber,
            deployment,
            cluster,
            shortSourceRegion
        ]
        prefixParts = prefixParts.filter(x => _.isNotNullOrUndefined(x));
        return prefixParts;
    }

    function getPrefix()
    {
        var prefixParts = getPrefixParts();
        prefixParts.push('');
        var prefix = prefixParts.join('_');
        prefix = prefix.toLowerCase();
        logger.info("[STORAGE] QUERY prefix: %s", prefix);
        return prefix;
    }

    function getNaming(obj)
    {
        var naming = [
            gcpProjectNumber,
            obj.labels['berlioz_deployment'],
            obj.labels['berlioz_cluster'],
            obj.labels['berlioz_region'],
            obj.labels['berlioz_sector'],
            obj.labels['berlioz_database']
        ]
        return naming;
    }
}
