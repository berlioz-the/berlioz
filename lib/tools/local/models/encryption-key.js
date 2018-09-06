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
            return aws.KeyManagement.queryAllKeys(tags)
                .then(result => {
                    helper.saveEncryptionKeys(result);
                    if (result) {
                        return result.filter(x => x.KeyState != 'PendingDeletion');
                    }
                    return [];
                });
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
            logger.info("---- KEY BEGIN")
            var tags = {
                "berlioz:deployment": delta.naming[0],
                "berlioz:cluster": delta.naming[1],
                "berlioz:sector": delta.naming[2]
            }
            var cachedKey = helper.findEncryptionKey(tags);

            if (cachedKey) {
                logger.info("---- CACHED KEY: ", cachedKey)
                return aws.KeyManagement.queryKey(cachedKey.KeyId)
                    .then(keyObj => {
                        logger.info("---- REFRESHED CACHED KEY: ", cachedKey)
                        if (keyObj.KeyState == 'PendingDeletion') {
                            logger.info("---- IS PENDING DELETION: ", keyObj)
                            return Promise.resolve()
                                .then(() => aws.KeyManagement.cancelKeyDeletion(keyObj.KeyId))
                                .then(() => aws.KeyManagement.enableKey(keyObj.KeyId))
                        } else if (keyObj.KeyState == 'Disabled') {
                            logger.info("---- IS Disabled: ", keyObj)
                            return Promise.resolve()
                                .then(() => aws.KeyManagement.enableKey(keyObj.KeyId))
                        } else {
                            logger.info("---- KEY IS READY: ", keyObj)
                            return keyObj;
                        }
                    })
            } else {
                screen.info('Creating %s...', delta.dn);
                return aws.KeyManagement.createKey({}, tags);
            }
        })
        .onUpdate(delta => {
            if ('KeyState' in delta.delta.configs) {
                if (delta.delta.configs['KeyState'].oldValue == "Disabled") {
                    return aws.KeyManagement.enableKey(delta.id);
                }
            }
        })
        .onDelete(delta => {
            screen.info('Deleting %s...', delta.dn);
            return Promise.resolve()
                // .then(() => {
                //     if (delta.obj.KeyState != 'PendingDeletion') {
                //         var tagNames = _.keys(delta.obj.Tags);
                //         return aws.KeyManagement.removeKeyTags(delta.id, tagNames);
                //     }
                // })
                .then(() => {
                    if (delta.obj.KeyState != 'PendingDeletion') {
                        return aws.KeyManagement.scheduleKeyDeletion(delta.id);
                    }
                })

                ;
        })
        ;

}
