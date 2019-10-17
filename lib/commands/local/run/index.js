
module.exports = {

    useLocalDeployer: true,

    arguments: [
        {
            name: 'cluster',
            optional: true
        }
    ],

    flags: [
        'quick'
    ],


    exec: function({Promise, _, args, logger, screen, localDeployer, config}) {
        localDeployer.makeQuick(args['quick']);

        return localDeployer.deployClusters(args.cluster)
            .then(() => {
                var clusterNames;
                if (args.cluster) {
                    clusterNames = [args.cluster, "sprt"];
                    clusterNames = _.uniq(clusterNames);
                } else {
                    clusterNames = _.keys(config.repoStore.get('local-deployed-clusters', []));
                }
                return Promise.serial(clusterNames, x => localDeployer.outputClusterEndpoints(x));
            });
    }
}
