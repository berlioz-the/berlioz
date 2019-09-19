const _ = require('the-lodash');

module.exports.getNaming = function({entity, scope, providerHelper}) {
    return [
        scope.deployment,
        entity.clusterName,
        scope.shortSourceRegion,
        entity.sectorName,
        entity.name];
}

module.exports.massageNamingPart = function(x) {
    return x.toString().toLowerCase()
}

module.exports.getModelName = function({entity, scope}) {
    return 'gcp-firestore'
}


module.exports.setupItem = function({config, entity, item, providerHelper}) {
    return Promise.resolve()
    .then(() => providerHelper.registerGcpApiDependency(item, 'datastore.googleapis.com'))
    .then(() => providerHelper.registerGcpApiDependency(item, 'firestore.googleapis.com'))
    ;
}