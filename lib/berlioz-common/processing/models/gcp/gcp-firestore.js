module.exports = (section, logger, {Promise, _, helper, gcp, gcpAccountId, deployment, cluster, region}) => {
    section
        .onQueryAll(() => {
            return [];
        })
        .onExtractNaming(obj => obj.naming)
        .onExtractId(obj => obj.naming)
        .onQuery(id => ({ naming: id }))
        .onExtractConfig(obj => { 
            return {
            };
        })
        .markUseDefaultsForDelta()
        .onCreate(delta => {
            return {
                naming: delta.naming
            }
        })
        ;

    function getPrefixParts()
    {
        var prefixParts = [
            gcpAccountId,
            deployment,
            cluster,
            region
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
            gcpAccountId,
            obj.labels['berlioz_deployment'],
            obj.labels['berlioz_cluster'],
            obj.labels['berlioz_region'],
            obj.labels['berlioz_sector'],
            obj.labels['berlioz_database']
        ]
        return naming;
    }
}
