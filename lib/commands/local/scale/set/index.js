
module.exports = {

    useLocalDeployer: true,

    arguments: [
        {
            name: 'cluster',
            autocomplete_target: 'local-cluster'
        },
        {
            name: 'service',
            autocomplete_target: 'local-service'
        },
        {
            name: 'value'
        }
    ],

    exec: function({_, args, screen, localDeployer}) {
        return localDeployer.setupScale(args.cluster, args.service, args.value)
            .then(() => localDeployer.outputClusterEndpoints(args.cluster));
    }

}
