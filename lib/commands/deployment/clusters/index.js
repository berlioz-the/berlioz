
module.exports = {

    useClient: true,

    arguments: [
        {
            name: 'name',
            autocomplete_target: 'deployment'
        },
        {
            name: 'cluster',
            optional: true
        },
        {
            name: 'region',
            optional: false
        }
    ],

    exec: function({args, client, screen}) {
        var data = {
            deployment: args.name,
            region: args.region
        };
        if (args.cluster) {
            data.cluster = args.cluster;
        }
        return client.post(args.region, '/deployment-clusters/fetch', data)
            .then(result => {
                screen.table(['Cluster', 'Region', 'Latest Version', 'Target Version', 'Current Version'])
                    .addRange(result, x => [x.cluster, x.region, x.latestVersion, x.targetVersion, x.currentVersion])
                    .output();
            });
    }

}
