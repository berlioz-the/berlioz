module.exports = (section, logger, {Promise, _, helper, gcp, gcpAccountId, deployment, cluster, region}) => {
    section
        .onQueryAll(() => {
            return gcp.PubSub.queryAllSubscriptions(getPrefix());
        })
        .onExtractNaming(obj => getNaming(obj.name))
        .onExtractId(obj => obj.name)
        .onQuery(id => gcp.PubSub.querySubscription(id))
        .onExtractConfig(obj => { 
            return {
                config: obj
            };
        })
        .onExtractRelations(item => {
            if (item.obj.topic != "_deleted-topic_") {
                item.relation('gcp-pubsub', getNaming(item.obj.topic));
            }
        })
        .markUseDefaultsForDelta()
        .onCreate(delta => {
            var name = delta.naming.join('_');
            var topic = delta.findRelation('gcp-pubsub').targetItem.id;
            return gcp.PubSub.createSubscription(name, topic);
        })
        .onUpdateRecreate(delta => {
            if (delta.delta.relations.length > 0) {
                for(var relDelta of delta.delta.relations) {
                    if (relDelta.targetMeta == 'gcp-pubsub') {
                        return true;
                    }
                }
            }
            return false;
        })
        .onDelete(delta => {
            return gcp.PubSub.deleteSubscription(delta.id);
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
        var prefix = 'projects/' + gcpAccountId + '/subscriptions/' + namePrefix;
        logger.info("[PUBSUB-SUB] QUERY prefix: %s", prefix);
        return prefix;
    }

    function getNaming(id)
    {
        var parts = id.split('/');
        var fullName = _.last(parts);
        var naming = fullName.split('_');
        return naming;
    }
}
