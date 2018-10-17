const Deployer = require('../../tools/deployer')

module.exports = {

    useWaiter: true,
    useClient: true,

    arguments: [
        'deployment',
        {
            name: 'cluster',
            optional: true
        },
        {
            name: 'region',
            optional: false
        }
    ],

    flags: [
        'force'
    ],

    exec: function({args, screen, logger, client, waiter}) {
        var deployer = new Deployer(logger, screen, client, 'undeploy', args.deployment);
        deployer.setRegion(args.region);
        if (args.force) {
            deployer.setForceDeploy();
        }
        if (args.cluster) {
            deployer.setCluster(args.cluster);
        }
        return deployer.perform()
            .then(() => waiter.perform({
                deployment: args.deployment,
                cluster: args.cluster,
                region: args.region
            }));
    }
}
