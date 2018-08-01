const Publisher = require('../../tools/publisher')
const Builder = require('../../tools/builder')
const fs = require('fs')

module.exports = {

    useProject: true,
    useDocker: true,

    arguments: [
        {
            name: 'cluster',
            optional: true
        },
        {
            name: 'image',
            optional: true
        },
        {
            name: 'version-metadata-path',
            optional: true
        }
    ],

    flags: [
        'skip-build'
    ],

    exec: function({args, registry, client, logger, screen, Promise, docker, config}) {
        var publisher = new Publisher(logger, registry, config, client);
        if (args.cluster) {
            publisher.setTargetCluster(args.cluster);
        }
        if (args.image) {
            publisher.setTargetImage(args.image);
        }

        return Promise.resolve()
            .then(() => {
                if (args['skip-build']) {
                    return;
                }
                var builder = new Builder(logger, registry, config, docker, screen);
                return builder.perform();
            })
            .then(() => {
                return publisher.perform();
            })
            .then(clusterVersionInfo => {
                if (args['version-metadata-path']) {
                    var data = JSON.stringify(clusterVersionInfo, null, 2)
                    fs.writeFileSync(args['version-metadata-path'], data);
                }
                screen.header('CLUSTER VERSIONS');
                screen.table(['Deployment', 'Cluster', 'Region', 'Version'])
                    .addRange(clusterVersionInfo, x => [x.deployment, x.cluster, x.region, x.date])
                    .output();
            });
    }

}
