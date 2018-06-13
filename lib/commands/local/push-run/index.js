const Builder = require('../../../tools/builder')

module.exports = {

    useProject: true,
    useLocalDeployer: true,

    arguments: [
    ],

    exec: function({args, registry, logger, Promise, localDeployer, screen}) {

        return Promise.resolve()
            .then(() => {
                if (args['skip-build']) {
                    return;
                }
                var builder = new Builder(logger, registry, screen);
                return builder.perform();
            })
            .then(() => {
                return localDeployer.pushImages(registry);
            })
            .then(() => Promise.serial(registry.clusters(), x => provisionCluster(x)))
            .then(() => Promise.serial(registry.clusters(), x => localDeployer.outputClusterEndpoints(x.name)))
            ;

        function provisionCluster(cluster)
        {
            return localDeployer.deployClusters(cluster.name, screen);
        }
    }

}
