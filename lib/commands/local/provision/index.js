
module.exports = {

    useLocalDeployer: true,

    arguments: [
        {
            name: 'cluster',
            optional: true
        }
    ],

    exec: function({Promise, _, args, logger, screen, localDeployer, config}) {

        return localDeployer.deployClusters(args.cluster, screen)
            .then(() => {
                if (args.cluster) {
                    localDeployer.outputClusterEndpoints(args.cluster)
                } else {
                    var clusterNames = _.keys(config.repoStore.get('local-deployed-clusters', []));
                    for(var cluster of clusterNames) {
                        localDeployer.outputClusterEndpoints(cluster);
                    }
                }
            });
    }
}
