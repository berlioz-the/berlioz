
module.exports = {

    useClient: true,

    arguments: [
        {
            name: 'name',
            optional: true
        },
        {
            name: 'cluster',
            optional: true
        },
        {
            name: 'region',
            optional: false
        },
        {
            name: 'service',
            optional: true
        },
        {
            name: 'endpoint',
            optional: true
        },
        {
            name: 'property',
            optional: true
        }
    ],

    exec: function({_, args, client, screen}) {
        var data = {
            deployment: args.name,
            cluster: args.cluster,
            region: args.region,
            service: args.service,
            endpoint: args.endpoint,
            property: args.property
        };

        return client.post(args.region, '/deployment-clusters/fetch-configs', data)
            .then(result => {
                screen.table(['Deployment', 'Cluster', 'Region', 'Service', 'Endpoint', 'Property', 'Value'])
                    .addRange(result, x => [x.deployment, x.cluster, x.region, x.service, x.endpoint, x.property, x.value])
                    .output();
            });
    }

}
