
module.exports = {

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
            optional: true
        }
    ],

    exec: function({args, client, screen}) {
        var data = {
            deployment: args.name
        };
        if (args.cluster) {
            data.cluster = args.cluster;
        }
        if (args.region) {
            data.region = args.region;
        }
        return client.post('/deployment-clusters/fetch', data)
            .then(result => {
                screen.table(['Cluster', 'Region', 'Latest Version', 'Target Version', 'Current Version'])
                    .addRange(result, x => [x.cluster, x.region, x.latestVersion, x.targetVersion, x.currentVersion])
                    .output();
            });
    }

}
