const Deployer = require('../../tools/deployer')

module.exports = {

    useWaiter: true,

    arguments: [
        'deployment',
        {
            name: 'cluster',
            optional: true
        },
        {
            name: 'region',
            optional: true
        }
    ],

    flags: [
        'force'
    ],

    exec: function({args, screen, logger, client, waiter}) {
        var deployer = new Deployer(logger, screen, client, 'undeploy', args.deployment);
        if (args.force) {
            deployer.setForceDeploy();
        }
        if (args.cluster) {
            deployer.setCluster(args.cluster);
        }
        if (args.region) {
            deployer.setRegion(args.region);
        }
        return deployer.perform()
            .then(() => waiter.perform({
                deployment: args.deployment,
                cluster: args.cluster,
                region: args.region
            }));
    }
}
