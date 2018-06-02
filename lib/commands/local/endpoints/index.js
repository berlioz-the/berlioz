
module.exports = {

    useLocalDeployer: true,

    arguments: [
        {
            name: 'cluster',
            optional: true,
            autocomplete_target: 'local-cluster'
        }
    ],

    exec: function({_, args, screen, localDeployer, config}) {

        if (args.cluster)
        {
            return localDeployer.outputClusterEndpoints(args.cluster);
        }
        else
        {
            var clusterMap = config.repoStore.get('local-endpoints-public', []);
            for(var cluster of _.keys(clusterMap))
            {
                localDeployer.outputClusterEndpoints(cluster);
            }
        }
    }

}
