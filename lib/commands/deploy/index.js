module.exports = {

    useProject: true,
    useDocker: true,
    useClient: true,
    useWaiter: true,

    arguments: [
        "region",
        'deployment',
        {
            name: 'cluster',
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
        'skip-build',
        'force'
    ],

    exec: function({args, registry, client, dataProvider, waiter, inputError, logger, screen, _, Promise, docker, config, storage, shell}) {

        var clusterNames = null;
        return Promise.resolve()
            .then(() => {
                const PushCommand = require('../push')
                return PushCommand.exec({args, registry, dataProvider, logger, screen, Promise, docker, config, storage, shell});
            })
            .then(() => {
                var clusters = registry.clusters;
                if (args.cluster) {
                    clusters = clusters.filter(x => x.name == args.cluster);
                }
                clusterNames = clusters.map(x => x.name);
                const RunCommand = require('../run')

                if (clusterNames.length == 0) {
                    screen.info("No clusters matches the criteria.");
                    return;
                }

                return Promise.serial(clusterNames, clusterName => {
                    var runArgs = _.clone(args);
                    runArgs.cluster = clusterName;
                    return RunCommand.exec({
                        args: runArgs, 
                        screen, 
                        logger, 
                        client, 
                        inputError
                    });
                })
            })
            .then(() => {
                return Promise.serial(clusterNames, clusterName => {
                    waiter.perform({
                        deployment: args.deployment,
                        cluster: clusterName,
                        region: args.region
                    })
                })
            })
            ;
    }

}
