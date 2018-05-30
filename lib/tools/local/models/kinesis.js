module.exports = (section, logger, {Promise, _, aws, helper, cluster, deployment, screen}) => {
    section
        .onQueryAll(() => {
            if (!aws) {
                logger.warn('AWS is missing. Cannot query kinesis queues.');
                return [];
            }
            return aws.Kinesis.queryAll(deployment + '-' + cluster + '-');
        })
        .onExtractNaming(obj => helper.splitNaming(obj.StreamName, 2))
        .onExtractId(obj => obj.StreamName)
        .onQuery(id => aws.Kinesis.query(id))
        .onExtractConfig(obj => ({
        }))
        .onCreate(delta => {
            if (!aws) {
                return;
            }
            screen.info('Creating %s...', delta.dn);
            return aws.Kinesis.create(delta.naming.join('-'));
        })
        .onDelete(delta => {
            if (!aws) {
                return;
            }
            screen.info('Deleting %s...', delta.dn);
            return Promise.resolve()
                .then(() => helper._taskMetaStore.deleteKinesis(delta.item))
                .then(() => aws.Kinesis.delete(delta.id))
                ;
        })
        .onPostCreate(item => {
            return helper._taskMetaStore.createKinesis(item)
        })
        ;

}
