const _ = require('the-lodash');

module.exports.checkSkip = function({entity, scope, consumer, targetEntity}) {
    if (entity.hasInitScript) {
        return true;
    }
    return false;
}

module.exports.getNaming = function({entity, scope, ownerItem}) {
    return [
        ownerItem.dn
    ];
}

module.exports.getModelName = function({entity, scope}) {
    return 'gcp-sql-script'
}

module.exports.setupItem = function({processor, entity, item, ownerItem, scope}) {
    item.relation(ownerItem)

    var repoInfo = processor.getRepository(entity);
    var runtime = {
        src: _.clone(repoInfo)
    }

    var initDbEntity = getInitDb(entity);
    var bucketNameParts = [
        scope.gcpAccountId,
        scope.deployment,
        initDbEntity.clusterName,
        scope.region,
        initDbEntity.sectorName,
        initDbEntity.name];
    var bucketName = bucketNameParts.join('_');
    runtime.dest = {
        bucket: bucketName
    }

    item.setRuntime(runtime);

    return Promise.resolve()
        .then(() => item.relation(ownerItem))
        .then(() => {
            var storageDn = item.meta.root.constructDn('storage', bucketNameParts);
            return item.relation('gcp-policy', [storageDn]).then(rel => rel.markIgnoreDelta())
        })
}

function getInitDb(entity)
{
    for(var consumed of entity.databasesConsumes)
    {
        var targetDb = consumed.localTarget;
        if (targetDb) {
            if ((targetDb.sectorName == 'init') && 
                (targetDb.name == entity.name)) {
                return targetDb;
            }
        }
    }
    return null;
}