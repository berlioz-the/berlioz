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

module.exports.setupItem = function({config, entity, item, providerHelper, scope}) {

    var config = {};
    config.settings = config.settings || {};

    var instanceTypePolicy = entity.resolvePolicy("instance-type");
    config.settings.tier = instanceTypePolicy.value;
    if (!config.settings.tier) {
        config.settings.tier = 'db-n1-standard-1';
    }

    if (scope.region) {
        config.region = scope.region;
    }
    if (scope.zone && (scope.zone != scope.region)) {
        config.settings.locationPreference = {
            zone: scope.zone,
            kind: "sql#locationPreference"
        }
    }

    item.setConfig('config', config);

    return providerHelper.registerGcpApiDependency(item, 'sqladmin.googleapis.com')
}