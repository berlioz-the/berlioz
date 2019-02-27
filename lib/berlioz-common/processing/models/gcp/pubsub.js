module.exports = (section, logger, {Promise, _, helper, gcp, gcpAccountId, deployment, cluster, region}) => {
    section
        .onQueryAll(() => {
            return gcp.PubSub.queryAllTopics(getPrefix());
        })
        .onExtractNaming(obj => getNaming(obj))
        .onExtractId(obj => obj.name)
        .onQuery(id => gcp.PubSub.queryBucket(id))
        .onExtractConfig(obj => { 
            return {
                config: obj
            };
        })
        .markUseDefaultsForDelta()
        .onCreate(delta => {
            var name = delta.naming.join('_');
            return gcp.PubSub.createTopic(name, delta.config.config);
        })
        // .onUpdate(delta => {
        // })
        .onDelete(delta => {
            return gcp.PubSub.deleteTopic(delta.id);
        })
        ;

    function getNamePrefixParts()
    {
        var namePrefixParts = [
            deployment,
            cluster,
            region
        ]
        namePrefixParts = namePrefixParts.filter(x => _.isNotNullOrUndefined(x));
        return namePrefixParts;
    }

    function getPrefix()
    {
        var namePrefixParts = getNamePrefixParts();
        namePrefixParts.push('');
        var namePrefix = namePrefixParts.join('_');
        var prefix = 'projects/' + gcpAccountId + '/topics/' + namePrefix;
        logger.info("[PUBSUB] QUERY prefix: %s", prefix);
        return prefix;
    }

    function getNaming(obj)
    {
        var prefix = getPrefix();
        logger.info("[PUBSUB] prefix: %s", prefix);
        logger.info("[PUBSUB] obj.name: %s", obj.name);
        var restName = _.replaceAll(obj.name, prefix, '');
        logger.info("[PUBSUB] restName: %s", restName);
        var restParts = restName.split('_');
        logger.info("[PUBSUB] restParts: %s", restParts);
        return _.concat(getNamePrefixParts(), restParts);
    }
}
