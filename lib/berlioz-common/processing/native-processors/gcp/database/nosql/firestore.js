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
    return 'gcp-firestore'
}