const _ = require('the-lodash');

module.exports.getNaming = function({entity, scope}) {
    return [
        scope.deployment,
        entity.clusterName,
        scope.shortRegion,
        entity.sectorName,
        entity.name];
}

module.exports.massageNamingPart = function(x) {
    return x.toString().toLowerCase()
}

module.exports.getModelName = function({entity, scope}) {
    return 'gcp-sql'
}

module.exports.setupItem = function({config, entity, item, providerHelper}) {
    item.setConfig('config', {
        settings: {
            tier: 'db-n1-standard-1'
        }
    });

    return providerHelper.registerGcpApiDependency(item, 'sqladmin.googleapis.com')
}