module.exports.getNaming = function({entity, scope}) {
    return [
        scope.deployment,
        entity.clusterName,
        scope.region,
        entity.sectorName,
        entity.name];
}

module.exports.getModelName = function({entity, scope}) {
    return 'pubsub'
}

module.exports.setupItem = function({config, entity, item, scope}) {
    item.setConfig('config', {
    });
}