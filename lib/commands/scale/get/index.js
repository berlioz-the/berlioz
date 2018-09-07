
module.exports = {

    arguments: [
        'deployment',
        {
            name: 'cluster',
            optional: true
        },
        {
            name: 'region',
            optional: true
        },
        {
            name: 'service',
            optional: true
        }
    ],

    exec: function({_, args, client, screen}) {
        var data = {
            deployment: args.deployment,
            cluster: args.cluster,
            region: args.region,
            service: args.service,
            property: 'task-count'
        };

        return client.post('/deployment-clusters/fetch-configs', data)
            .then(result => {
                screen.table(['Cluster', 'Region', 'Service', 'Property', 'Value'])
                    .addRange(result, x => [x.cluster, x.region, x.service, x.property, x.value])
                    .output();
            });
    }

}
