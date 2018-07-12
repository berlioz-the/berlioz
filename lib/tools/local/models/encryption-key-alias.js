module.exports = (section, logger, {Promise, _, aws, helper, cluster, deployment, screen}) => {
    section
        .onQueryAll(() => {
            if (!aws) {
                logger.warn('AWS is missing. Cannot query  encryption key aliases.');
                return [];
            }
            return aws.KeyManagement.queryAllAliases(deployment + '/' + cluster);
        })
        .onExtractNaming(obj => {
            return [obj.AliasName];
        })
        .onExtractId(obj => obj.AliasName)
        // .onQuery(id => aws.KeyManagement.queryAlias(id))
        .onCreate(delta => {
            if (!aws) {
                return;
            }
            var keyItem = delta.findRelation('encryption-key').targetItem;
            screen.info('Creating %s...', delta.dn);
            return aws.KeyManagement.createAlias(delta.naming[0], keyItem.id);
        })
        .onDelete(delta => {
            if (!aws) {
                return;
            }
            screen.info('Deleting %s...', delta.dn);
            return aws.KeyManagement.deleteAlias(delta.id);
        })
        ;

}
