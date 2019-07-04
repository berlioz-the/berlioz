module.exports = (section, logger, {Promise, _, helper, gcp, gcpAccountId, deployment, cluster, region}) => {
    section
        .priority(1000)
        .onQueryAll(() => {
            var metaNames = helper.nativeProcessor.getPolicyHandlerNames();
            logger.info("[GCP-POLICY] ", metaNames);
            return Promise.serial(metaNames, x => queryAllFromKind(x))
                .then(results => {
                    return _.flatten(results);
                });
        })
        .onExtractNaming(obj => [
            obj.target
        ])
        .onExtractId(obj => obj.id)
        .onQuery(id => queryFromTarget(id))
        .onExtractConfig(obj => { 
            return {
                kind: obj.kind,
                policy: obj.policy
            }
        })
        .onExtractRelations(item => {
            item.relation(item.naming[0]);

            for(var dn of _.keys(item.obj.relations)) {
                var email = item.obj.relations[dn];
                var serviceAccount = helper.getServiceAccountItem(email)
                if (serviceAccount) {
                    item.relation(serviceAccount.dn);
                }
            }
        })
        .onAutoConfig((item, action) => {
            if (action == 'delete') {
                return true;
            }

            for(var relation of item.findRelations('gcp-sql'))
            {
                var sql = relation.targetItem;
                if (sql) {
                    if (!setupSqlServiceAccount(item, sql)) {
                        return false;
                    }
                }
            }

            return true;
        })
        .onCreate(delta => {
            return applyPolicy(delta)
        })
        .onUpdate(delta => {
            return applyPolicy(delta)
        })
        .onDelete(delta => {
            
        })
        ;

    function queryAllFromKind(kind)
    {
        var targets = helper._currentConfig.section(kind).items;
        return Promise.serial(targets, target => queryFromTarget(target))
            .then(result => {
                return result.filter(x => x);
            });
    }
    
    function queryFromTarget(target)
    {
        logger.info('[queryAllFromTarget] %s :: %s -> %s...', target.meta.name, target.dn, target.id);
        var queryCb = helper.nativeProcessor.getPolicyHandler(target.meta.name).query;
        if (!queryCb) {
            return null;
        }
        return queryCb(target.id)
            .then(policy => {
                if (!policy) {
                    return null;
                }
                var massagedPolicy = {

                }
                var relations = {

                }
                for(var x of policy) {
                    for(var member of x.members) {
                        var i = member.indexOf(':')
                        var memberType = member.substring(0, i);
                        var memberId = member.substring(i + 1);

                        if (memberType == 'serviceAccount') {
                            var serviceAccount = helper.getServiceAccountItem(memberId)
                            if (serviceAccount) {
                                addToPolicy(massagedPolicy, x.role, 'relation', memberType, serviceAccount.dn);
                                relations[serviceAccount.dn] = memberId;
                            } else {
                                addToPolicy(massagedPolicy, x.role, 'id', memberType, memberId);
                            }
                        } else {
                            addToPolicy(massagedPolicy, x.role, 'id', memberType, memberId);
                        }
                    }
                }
                return {
                    id: {
                        id: target.id,
                        dn: target.dn,
                        meta: {
                            name: target.meta.name
                        }
                    },
                    target: target.dn,
                    kind: target.meta.name,
                    policy: massagedPolicy,
                    relations: relations
                }
            });
    }

    function addToPolicy(policy, role, folder, memberType, memberId)
    {
        if (!policy[role]) {
            policy[role] = {
                id: {},
                relation: {}
            }
        }
        if (!policy[role][folder][memberType]) {
            policy[role][folder][memberType] = {}
        }
        policy[role][folder][memberType][memberId] = true;
    }

    function getBody(obj)
    {
        var result = []        
        for(var role of _.keys(obj)) {
            var roleResult = getRoleBody(role, obj[role]);
            if (roleResult) {
                result.push(roleResult);
            }
        }
        return result;
    }

    function getRoleBody(role, obj)
    {
        var result = {
            role: role,
            members: []
        }
        for(var memberKind of _.keys(obj.id)) {
            for(var memberId of _.keys(obj.id[memberKind])) {
                var member = memberKind + ':' + memberId;
                result.members.push(member);
            }
        }
        for(var memberKind of _.keys(obj.relation)) {
            for(var targetDn of _.keys(obj.relation[memberKind])) {
                var target = helper._currentConfig.findDn(targetDn);
                if (target) {
                    // TODO: make this generic
                    var member = memberKind + ':' + target.obj.email;
                    result.members.push(member);
                }
            }
        }
        if (result.members.length == 0) {
            return null;
        }
        return result;
    }

    function applyPolicy(delta)
    {
        logger.info('[applyPolicy] %s...', delta.dn);

        var policyBody = getBody(delta.config.policy);
        logger.info('[applyPolicy] %s, policyBody: ', delta.dn, policyBody);

        var target = helper._currentConfig.findDn(delta.naming[0]);
        if (!target) {
            logger.warn('[applyPolicy] %s. target is missing.', delta.dn);
            return;
        }
        if (!target.id) {
            logger.warn('[applyPolicy] %s. target is not present.', delta.dn);
            return;
        }
        var applyCb = helper.nativeProcessor.getPolicyHandler(target.meta.name).apply;
        if (!applyCb) {
            logger.warn('[applyPolicy] %s. apply cb not present.', delta.dn);
            return null;
        }
        logger.info('[applyPolicy] %s. applying...', delta.dn, policyBody);
        return applyCb(target.id, policyBody)
            .then(() => {
                return queryFromTarget(target);
            });
    }

    function setupSqlServiceAccount(item, sql)
    {
        if (!sql.obj) {
            helper.postponeWithTimeout(1 * 60, `SQL ${sql.dn} is not yet ready`);
            return false;
        }
        var serviceAccount = sql.obj.serviceAccountEmailAddress;
        if (!serviceAccount) {
            helper.postponeWithTimeout(1 * 60, `SQL Service Account not present for ${sql.dn}`);
            return false;
        }
        var role = 'roles/storage.objectViewer';
        addToPolicy(item.config.policy, role, 'id', 'serviceAccount', serviceAccount);
        return true;
    }
}
