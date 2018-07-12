module.exports = (section, logger, {Promise, _, aws, helper, cluster, deployment, screen}) => {
    section
        .onQueryAll(() => {
            if (!aws) {
                logger.warn('AWS is missing. Cannot query parameters.');
                return [];
            }
            return aws.SystemsManager.queryAllParams('/' + deployment + '/' + cluster + '/');
        })
        .onExtractNaming(obj => {
            return [obj.Name];
        })
        .onExtractId(obj => obj.Name)
        .onQuery(id => aws.SystemsManager.queryParam(id))
        .onExtractConfig(obj => ({
            Type: obj.Type
        }))
        .onExtractRelations(item => {
            if (item.obj.KeyId) {
                item.relation('encryption-key-alias', [item.obj.KeyId])
            }
        })
        .onCreate(delta => createParam(delta))
        .onDelete(delta => deleteParam(delta))
        .onUpdate(delta => {
            return Promise.resolve()
                .then(() => deleteParam(delta))
                .then(() => createParam(delta))    
        })
        ;

    function createParam(delta)
    {
        if (!aws) {
            return;
        }

        screen.info('Creating %s...', delta.dn);
        var params = {
            Type: delta.config.Type,
            Overwrite: true
        }

        var keyItem = delta.findRelation('encryption-key-alias').targetItem;
        if (keyItem) {
            params.KeyId = keyItem.id;
        }
        
        var value = delta.runtime.Value;
        return aws.SystemsManager.writeParameter(delta.naming[0], value, params);
    }

    function deleteParam(delta)
    {
        if (!aws) {
            return;
        }
        screen.info('Deleting %s...', delta.dn);
        return aws.SystemsManager.deleteParam(delta.id);
    }
}
