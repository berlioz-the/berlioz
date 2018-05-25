
module.exports = {

    useLocalDeployer: true,

    arguments: [
        {
            name: 'cluster',
            optional: true
        }
    ],

    exec: function({Promise, args, logger, screen, localDeployer}) {

        return localDeployer.deployClusters(args.cluster, screen);
    }
}
