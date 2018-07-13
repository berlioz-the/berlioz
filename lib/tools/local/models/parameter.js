module.exports = (section, logger, {Promise, _, aws, helper, cluster, deployment, screen, autoconfigAwsObject}) => {
    section
        .onQueryAll(() => {
            if (!aws) {
                logger.warn('AWS is missing. Cannot query parameters.');
                return [];
            }
            return aws.SystemsManager.queryAllParams('/' + deployment + '/' + cluster + '/');
        })
        .onExtractNaming(obj => {
            var naming = _.trim(obj.Name, '/').split('/')
            return naming;
        })
        .onExtractId(obj => obj.Name)
        .onQuery(id => aws.SystemsManager.queryParam(id))
        .onExtractConfig(obj => ({
            Type: obj.Type
        }))
        .onExtractRelations(item => {
            if (item.obj.KeyId) {
                var naming = item.obj.KeyId.split('/')
                naming = _.drop(naming)
                item.relation('encryption-key-alias', naming)
            }
        })
        .onAutoConfig(autoconfigAwsObject)
        .onCreate(delta => createParam(delta))
        .onDelete(delta => deleteParam(delta))
        .onUpdate(delta => {
            return Promise.resolve()
                .then(() => deleteParam(delta))
                .then(() => createParam(delta))    
        })
        .onPostCreate(item => {
            return helper._taskMetaStore.createParameter(item)
        })
        ;

    function createParam(delta)
    {
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
        var name = '/' + delta.naming.join('/');
        return aws.SystemsManager.writeParameter(name, value, params);
    }

    function deleteParam(delta)
    {
        screen.info('Deleting %s...', delta.dn);
        return Promise.resolve()
            .then(() => helper._taskMetaStore.deleteParameter(delta.item))
            .then(() => aws.SystemsManager.deleteParam(delta.id))
            ;
    }
}
