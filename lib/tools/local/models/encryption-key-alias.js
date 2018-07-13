module.exports = (section, logger, {Promise, _, aws, helper, cluster, deployment, screen, autoconfigAwsObject}) => {
    section
        .onQueryAll(() => {
            if (!aws) {
                logger.warn('AWS is missing. Cannot query  encryption key aliases.');
                return [];
            }
            return aws.KeyManagement.queryAllAliases(deployment + '/' + cluster);
        })
        .onExtractNaming(obj => {
            var naming = obj.AliasName.split('/');
            naming = _.drop(naming);
            return naming;
        })
        .onExtractId(obj => obj.AliasName)
        // .onQuery(id => aws.KeyManagement.queryAlias(id))
        .onAutoConfig(autoconfigAwsObject)
        .onCreate(delta => {
            var keyItem = delta.findRelation('encryption-key').targetItem;
            screen.info('Creating %s...', delta.dn);
            var name = 'alias/' + delta.naming.join('/');
            return aws.KeyManagement.createAlias(name, keyItem.id);
        })
        .onDelete(delta => {
            screen.info('Deleting %s...', delta.dn);
            return aws.KeyManagement.deleteAlias(delta.id);
        })
        ;

}
