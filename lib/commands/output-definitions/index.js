const _ = require('the-lodash');

module.exports = {

    useProject: true,

    arguments: [
        {
            name: 'deployment',
            optional: true
        },
        {
            name: 'region',
            optional: true
        },
        {
            name: 'provider',
            optional: true
        },
        {
            name: 'providerKind',
            optional: true
        }
    ],

    flags: [
        'compile'
    ],

    exec: function({args, registry, screen, logger}) {
        return Promise.resolve()
            .then(() => {
                if (args.compile) {
                    var policyTarget = {
                        deployment: args['deployment'],
                        region: args['region'],
                        provider: args['provider'],
                        providerKind: args['providerKind']
                    }
                    return Promise.resolve(registry.scopePolicies(policyTarget))
                        .then(registry => registry.compile(logger, policyTarget))
                } else {
                    return registry;
                }
            })
            .then(registry => {
                for (var obj of registry.clusters) {
                    screen.outputCluster(obj);
                }
                for (var obj of registry.images) {
                    screen.header('IMAGE');
                    screen.outputEntity(obj);
                }
                for (var obj of registry.policies) {
                    screen.outputEntity(obj);
                }
            })
    }
}
