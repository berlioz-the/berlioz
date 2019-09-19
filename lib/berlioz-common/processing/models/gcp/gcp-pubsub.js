module.exports = (section, logger, {Promise, _, helper, gcp, gcpAccountId, deployment, cluster, shortSourceRegion}) => {
    section
        .onQueryAll(() => {
            return gcp.PubSub.queryAllTopics(getPrefix())
                .catch(reason => {
                    if (reason.isApiNotEnabled) {
                        return [];
                    }
                    throw reason;
                });
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
            shortSourceRegion
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
        var parts = obj.name.split('/');
        var fullName = _.last(parts);
        var naming = fullName.split('_');
        return naming;
    }
}
