const _ = require('the-lodash');

module.exports.getNaming = function({entity, scope}) {
    return [
        scope.gcpProjectNumber,
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
    return 'gcp-storage'
}

module.exports.setupItem = function({config, entity, item, scope, providerHelper}) {
    var labels = {
        'berlioz_deployment': scope.deployment,
        'berlioz_cluster': entity.clusterName,
        'berlioz_region': scope.shortSourceRegion,
        'berlioz_sector': entity.sectorName,
        'berlioz_database': entity.name
    }; 
    for(var x of _.keys(labels)) {
        labels[x] = labels[x].toString().toLowerCase();
    }
    item.setConfig('config', {
        location: scope.region.toUpperCase(),
        storageClass: 'REGIONAL',
        labels: labels
    });

    return providerHelper.registerGcpApiDependency(item, 'storage-api.googleapis.com')
}