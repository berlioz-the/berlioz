
module.exports = {

    useClient: true,

    arguments: [
        {
            name: 'name',
            autocomplete_target: 'deployment'
        },
        'cluster',
        'region'
    ],

    exec: function({args, client, screen}) {
        var data = {
            deployment: args.name,
            cluster: args.cluster,
            region: args.region
        };

        return client.post(args.region, '/deployment-clusters/versions', data)
            .then(result => {
                screen.table(['Deployment', 'Cluster', 'Region', 'Version', 'isCurrent', 'isTarget', 'isLatest'])
                    .addRange(result, x => [x.deployment, x.cluster, x.region, x.date, x.isCurrent, x.isTarget, x.isLatest])
                    .output();
            });
    }

}
