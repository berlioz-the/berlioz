const BaseItem = require('../entities/base')

module.exports = {
    name: "ExtendAWSLogSecret",

    canRunCluster: ({compiler, cluster, providerKind}) => {
        if (providerKind != 'aws') {
            return false;
        }
        if (cluster.lambdas.length == 0) {
            return false;
        }
        return true;
    },

    clusterAction: ({compiler, cluster}) => {
        var secretId = compiler._addImpicit({
            kind: 'secret',
            cluster: cluster.name,
            sector: 'infra',
            name: 'logs',
            class: 'symmetric',
            subClass: 'symmetric'
        })
    }
}