module.exports = (section, logger, {Promise, _, helper, gcp, gcpAccountId, deployment, cluster, shortRegion}) => {
    section
        .onQueryAll(() => {
            return [];
        })
        .onExtractNaming(obj => [obj.id])
        .onExtractId(obj => obj.id)
        .onQuery(id => {
            return {
                id: id
            }
        })
        .onExtractConfig(obj => { 
            return {
            };
        })
        .onExtractRelations(item => {
            var sqlDn = item.meta.root.breakDn(item.naming[0]);
            item.relation(sqlDn.metaName, sqlDn.naming);
        })
        .onAutoConfig((item, action) => {
            if (action == 'delete') {
                return true;
            }

            var sqlId = item.findRelation('gcp-sql').targetItem.id;
            if (!sqlId) {
                helper.postponeWithTimeout(1 * 60, `SQL: ${sqlId} is not yet present.`);
                return false;
            }
            logger.info("[GCP_SQL_SCRIPT] Checking sqlID: %s...", sqlId);
            return gcp.Sql.queryRunningInstanceOperations(sqlId)
                .then(operations => {
                    if (operations.length == 0) {
                        return true;
                    } else {
                        logger.info("[GCP_SQL_SCRIPT] sqlID: %s is busy. operations: ", sqlId, operations);
                        helper.postponeWithTimeout(2 * 60, `SQL: ${sqlId} is busy.`);
                        return false;
                    }
                });
        })
        .onCreate(delta => {
            var sqlId = delta.findRelation('gcp-sql').targetItem.id;
            logger.info("[GCP_SQL_SCRIPT] sqlID: %s", sqlId);
            logger.info("[GCP_SQL_SCRIPT] src: ", delta.runtime.src);
            logger.info("[GCP_SQL_SCRIPT] dest: ", delta.runtime.dest);
            return Promise.resolve()
                .then(() => {
                    if (delta.runtime.src.bucket) {
                        return gcp.Storage.copyDirectory(
                            delta.runtime.src.bucket, delta.runtime.src.key,
                            delta.runtime.dest.bucket, '/');
                    }
                    if (delta.runtime.src.path) {
                        return gcp.Storage.uploadLocalDirectory(
                            delta.runtime.src.path,
                            delta.runtime.dest.bucket, '');
                    }
                    throw new Error('Could not upload gcp sql script');
                })
                .then(() => {
                    return gcp.Sql.importSql(
                        sqlId, 
                        'sys',
                        `gs://${delta.runtime.dest.bucket}/init.sql`);
                })
                .then(() => {
                    return {
                        id: delta.naming[0]
                    }
                })
        })
        ;

}
