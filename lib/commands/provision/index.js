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
        },
        {
            name: 'version',
            optional: true
        }
    ],

    flags: [
        'force'
    ],

    exec: function({args, screen, logger, client, inputError}) {
        if (args.version) {
            if (!args.cluster) {
                inputError('When using version the cluster and region should be specified.');
            }
            if (!args.region) {
                inputError('When using version the cluster and region should be specified.');
            }
        }
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
        if (args.version) {
            deployer.setVersion(args.version);
        }
        return deployer.perform();
    }
}
