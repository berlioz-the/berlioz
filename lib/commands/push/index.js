const Publisher = require('../../tools/publisher')
const Builder = require('../../tools/builder')
const fs = require('fs')
const MyPublisherDataProvider = require('./publisher-data-provider')


module.exports = {

    useProject: true,
    useDocker: true,
    useClient: true,

    arguments: [
        "region",
        {
            name: 'cluster',
            optional: true
        },
        {
            name: 'deployment',
            optional: true
        },
        {
            name: 'image',
            optional: true
        },
        {
            name: 'version-metadata-path',
            optional: true
        },
        {
            name: 'tmp-build-dir',
            optional: true
        }
    ],

    flags: [
        'nocache',
        'skip-build'
    ],

    exec: function({args, registry, client, logger, screen, Promise, docker, config, storage}) {

        return Promise.resolve()
            .then(() => {
                if (args['skip-build']) {
                    return;
                }
                var builder = new Builder(logger, registry, config, docker, screen);
                builder.setNoCache(args['nocache']);
                builder.setTmpDir(args['tmp-build-dir']);
                return builder.perform();
            })
            .then(() => {
                var dataProvider = new MyPublisherDataProvider(client, args.region);
                var publisher = new Publisher(logger.sublogger('Publisher'), screen, registry, config, dataProvider, storage);
                publisher.setRegion(args.region);
                if (args.cluster) {
                    publisher.setTargetCluster(args.cluster);
                }
                if (args.deployment) {
                    publisher.setTargetDeployment(args.deployment);
                }
                if (args.image) {
                    publisher.setTargetImage(args.image);
                }
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
