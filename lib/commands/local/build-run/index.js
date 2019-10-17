const Builder = require('../../../tools/builder')

module.exports = {

    useProject: true,
    useDocker: true,
    useLocalDeployer: true,

    arguments: [
        {
            name: "cluster",
            optional: true
        },
        {
            name: "service",
            optional: true
        }
    ],

    flags: [
        'nocache',
        'skip-build',
        'quick'
    ],

    exec: function({args, registry, logger, Promise, _, localDeployer, docker, config, screen}) {

        localDeployer.makeQuick(args['quick']);

        return Promise.resolve()
            .then(() => {
                if (args['skip-build']) {
                    return;
                }
                var builder = new Builder(logger, registry, config, docker, screen);
                builder.filterCluster(args['cluster']);
                builder.filterService(args['service']);
                builder.setNoCache(args['nocache']);
                return builder.perform();
            })
            .then(() => Promise.serial(registry.clusters, x => provisionCluster(x)))
            .then(() => {
                var clusterNames = registry.clusters.map(x => x.name);
                clusterNames.push("sprt");
                clusterNames = _.uniq(clusterNames);
                return Promise.serial(clusterNames, x => localDeployer.outputClusterEndpoints(x))
            })
            ;

        function provisionCluster(cluster)
        {
            return localDeployer.deployClusters(cluster.name);
        }
    }

}
