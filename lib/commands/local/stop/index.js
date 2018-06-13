module.exports = {

    useProject: true,
    useLocalDeployer: true,

    arguments: [
        {
            name: 'cluster',
            optional: true
        }
    ],

    exec: function({Promise, _, args, registry, logger, screen, localDeployer}) {
        var clusterNames = null;
        if (args.cluster)
        {
            clusterNames = [args.cluster];
        }
        else
        {
            clusterNames = _.keys(localDeployer.repoStore.get('local-deployed-clusters', []));
        }
        if (clusterNames.length == 0) {
            screen.error('No cluster found to terminate.');
            return;
        }

        return Promise.resolve()
            .then(() => localDeployer.setup())
            .then(() => Promise.serial(clusterNames, x => localDeployer.undeployCluster(x)))
            ;
    }
}
