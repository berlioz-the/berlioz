module.exports = (section, logger, {Promise, _, aws, helper, cluster, deployment, screen, autoconfigAwsObject}) => {
    section
        .onQueryAll(() => {
            if (!aws) {
                logger.warn('AWS is missing. Cannot query dynamodb tables.');
                return [];
            }
            return aws.Dynamo.queryAll(deployment + '-' + cluster + '-');
        })
        .onExtractNaming(obj => helper.splitNaming(obj.TableName, 2))
        .onExtractId(obj => obj.TableName)
        .onQuery(id => aws.Dynamo.query(id))
        .onExtractConfig(obj => ({
            AttributeDefinitions: makeDict(obj.AttributeDefinitions, 'AttributeType'),
            KeySchema: makeDict(obj.KeySchema, 'KeyType')
        }))
        .onAutoConfig(autoconfigAwsObject)
        .onCreate(delta => {
            screen.info('Creating %s...', delta.dn);
            var config = {
                AttributeDefinitions: makeArray(delta.config.AttributeDefinitions),
                KeySchema: makeArray(delta.config.KeySchema)
            }
            return aws.Dynamo.create(delta.naming.join('-'), config);
        })
        .onDelete(delta => {
            screen.info('Deleting %s...', delta.dn);
            return Promise.resolve()
                .then(() => helper._taskMetaStore.deleteDynamo(delta.item))
                .then(() => aws.Dynamo.delete(delta.id))
                ;
        })
        .onPostCreate(item => {
            return helper._taskMetaStore.createDynamo(item)
        })
        ;

    function makeDict(items, keyToInclude)
    {
        var res = {};
        for(var item of items)
        {
            res[item.AttributeName] = {};
            res[item.AttributeName][keyToInclude] = item[keyToInclude];
        }
        return res;
    }

    function makeArray(dict)
    {
        var res = [];
        for(var key of _.keys(dict))
        {
            var item = {
                AttributeName: key
            }
            for(var x of _.keys(dict[key])) {
                item[x] = dict[key][x];
            }
            res.push(item);
        }
        return res;
    }
}
