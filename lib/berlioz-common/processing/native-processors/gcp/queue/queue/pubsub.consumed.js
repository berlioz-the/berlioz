module.exports.getNaming = function({entity, scope, consumer, targetEntity}) {
    return [
        scope.deployment,
        consumer.clusterName,
        scope.shortSourceRegion,
        consumer.sectorName,
        consumer.name,
        targetEntity.naming.join('-')];
}

module.exports.getModelName = function({entity, scope}) {
    return 'gcp-pubsub-subscription'
}

module.exports.setupItem = function({config, entity, item, scope, providerItem, providerHelper}) {
    item.setConfig('config', {
    });

    return Promise.resolve()
        .then(() => providerHelper.registerGcpApiDependency(item, 'pubsub.googleapis.com'))
        .then(() => item.relation(providerItem));
}

module.exports.checkSkip = function({entity}) {
    for(var action of entity.actions)
    {
        if (action == 'subscribe')
        {
            return true;
        }
    }
    return false;
}