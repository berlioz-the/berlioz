const BaseItem = require('../entities/base')

module.exports = {
    name: "ExtendAWSLogSecret",

    canRun: ({compiler, cluster}) => {
        if (compiler.policyTarget.providerKind != 'aws') {
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