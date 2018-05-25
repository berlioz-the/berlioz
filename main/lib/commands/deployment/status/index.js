
module.exports = {

    arguments: [
        {
            name: 'name',
            optional: true,
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

    exec: function({_, args, client, screen}) {
        var data = {
            deployment: args.name,
            cluster: args.cluster,
            region: args.region
        };

        return client.post('/deployment-clusters/status', data)
            .then(result => {
                screen.table(['Deployment', 'Cluster', 'Region', 'Desired State', 'Status'])
                    .addRange(result, x => [x.deployment, x.cluster, x.region, x.state, x.status])
                    .output();
            });
    }

}
