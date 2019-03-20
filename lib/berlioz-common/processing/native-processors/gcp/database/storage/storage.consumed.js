module.exports.checkSkip = function({entity, scope, consumer, targetEntity}) {
    if (consumer.kind != 'database') {
        return false;
    }
    if (consumer.className != 'sql') {
        return false;
    }
    if (consumer.subClassName != 'sql') {
        return false;
    }
    if (!consumer.hasInitScript) {
        return false;
    }
    return true;
}

module.exports.customCreate = function({processor, entity, scope, consumer, consumerItem, providerItem, targetEntity}) {

    processor.logger.info('[STORAGE-CONSUMED] customCreate, entity: %s...', entity.id);
    processor.logger.info('[STORAGE-CONSUMED] customCreate, consumerItem: %s...', consumerItem.dn);
    processor.logger.info('[STORAGE-CONSUMED] customCreate, providerItem: %s...', providerItem.dn);
    // return processor.setupTargetPolicyRole(providerItem, role, member)
    return processor.getTargetPolicy(providerItem)
        .then(policy => {
            processor.logger.info('[STORAGE-CONSUMED] customCreate, policy: %s...', policy.id);
            return policy.relation(consumerItem) //.meta.name, consumerItem.dn, null, relRuntime)
                .then(relation => relation.markIgnoreDelta())
                .then(() => policy);
        });
}