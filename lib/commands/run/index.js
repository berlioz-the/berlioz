const Deployer = require('../../tools/deployer')
const fs = require('fs')

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
        },
        {
            name: 'version-metadata-path',
            optional: true
        }
    ],

    flags: [
        'force'
    ],

    exec: function({args, screen, logger, client, inputError}) {
        if (args.version) {
            if (args['version-metadata-path']) {
                inputError('When using version the version-metadata-path cannot be specified.');
            }
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
        if (args['version-metadata-path']) {
            var versionMetadataStr = fs.readFileSync(args['version-metadata-path']);
            var versionMetadata = JSON.parse(versionMetadataStr);
            deployer.setVersionMetadata(versionMetadata);
        }
        return deployer.perform();
    }
}
