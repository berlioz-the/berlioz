const Deployer = require('../../tools/deployer')

module.exports = {

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

    exec: function({args, screen, logger, client}) {
        var deployer = new Deployer(logger, screen, client, 'deploy', args.deployment);
        if (args.force) {
            deployer.setForceDeploy();
        }
        if (args.cluster) {
            deployer.setCluster(args.cluster);
        }
        if (args.region) {
            deployer.setRegion(args.region);
        }
        return deployer.perform();
    }
}
