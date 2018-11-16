
module.exports = {

    useLocalDeployer: true,

    arguments: [
        {
            name: 'cluster',
            optional: true,
            autocomplete_target: 'local-cluster'
        }
    ],

    exec: function({_, args, screen, localDeployer, config, Promise}) {

        var clusterNames;
        if (args.cluster)
        {
            clusterNames = [args.cluster];
        }
        else
        {
            clusterNames = _.keys(config.repoStore.get('local-deployed-clusters', []));
        }
        return Promise.serial(clusterNames, x => localDeployer.outputClusterEndpoints(x));
    }

}
