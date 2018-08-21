module.exports = (section, logger, {Promise, _, aws, helper, cluster, deployment, screen, autoconfigAwsObject}) => {
    section
        .onQueryAll(() => {
            if (!aws) {
                logger.warn('AWS is missing. Cannot query encryption keys.');
                return [];
            }
            var tags = {
                "berlioz:deployment": deployment,
                "berlioz:cluster": cluster
            }
            return aws.KeyManagement.queryAllKeys(tags);
        })
        .onExtractNaming(obj => {
            return [obj.Tags["berlioz:deployment"], obj.Tags["berlioz:cluster"], obj.Tags["berlioz:sector"]];
        })
        .onExtractId(obj => obj.KeyId)
        .onQuery(id => aws.KeyManagement.queryKey(id))
        .onExtractConfig(obj => ({
            "KeyState": obj.KeyState
        }))
        .onAutoConfig(autoconfigAwsObject)
        .onCreate(delta => {
            var tags = {
                "berlioz:deployment": delta.naming[0],
                "berlioz:cluster": delta.naming[1],
                "berlioz:sector": delta.naming[2]
            }
            screen.info('Creating %s...', delta.dn);
            return aws.KeyManagement.createKey({}, tags);
        })
        .onDelete(delta => {
            screen.info('Deleting %s...', delta.dn);
            return Promise.resolve()
                .then(() => {
                    if (delta.obj.KeyState != 'PendingDeletion') {
                        var tagNames = _.keys(delta.obj.Tags);
                        return aws.KeyManagement.removeKeyTags(delta.id, tagNames);
                    }
                })
                .then(() => {
                    if (delta.obj.KeyState != 'PendingDeletion') {
                        return aws.KeyManagement.scheduleKeyDeletion(delta.id);
                    }
                })

                ;
        })
        .onUpdate(delta => {
            if ('KeyState' in delta.delta.configs) {
                if (delta.obj.KeyState == 'PendingDeletion') {
                    return aws.KeyManagement.cancelKeyDeletion(delta.id);
                } else if (delta.obj.KeyState == 'Disabled') {
                    return aws.KeyManagement.enableKey(delta.id);
                }
            }
        })
        ;

}
