
module.exports = {

    useLocalDeployer: true,

    arguments: [
        {
            name: 'cluster',
            autocomplete_target: 'local-cluster',
            optional: true
        },
        {
            name: 'service',
            autocomplete_target: 'local-service',
            optional: true
        }
    ],

    exec: function({_, args, screen, config}) {
        var entries = [];
        config.repoStore.loop('local-config', [],
            (cluster, serviceDict) => {
                if (args.cluster && args.cluster != cluster) {
                    return;
                }
                for(var service of _.keys(serviceDict))
                {
                    if (!args.service || args.service == service) {
                        entries.push([cluster, service, serviceDict[service]]);
                    }
                }
            });

        screen.table(['Cluster', 'Service',  'Value'])
            .addRange(entries, x => x)
            .output();
    }

}
