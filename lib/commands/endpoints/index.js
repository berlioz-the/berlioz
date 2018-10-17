
module.exports = {

    useClient: true,

    arguments: [
        {
            name: 'deployment'
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
            name: 'endpoint',
            optional: true
        }
    ],

    exec: function({_, args, client, screen}) {
        var data = {
            deployment: args.deployment,
            cluster: args.cluster,
            region: args.region,
            endpoint: args.endpoint
        };

        return client.post(args.region, '/deployment-clusters/public-endpoints', data)
            .then(result => {
                for(var endpointData of result) {
                    screen.header('Cluster: %s, Region %s, Endpoint: %s', endpointData.cluster, endpointData.region, endpointData.endpoint);
                    screen.outputEndpoints(endpointData.members);
                }
            });
    }

}
