
module.exports = {

    useClient: true,

    arguments: [
        {
            name: 'deployment'
        },
        'cluster',
        'region',
        'service',
        'value'
    ],

    exec: function({_, args, client, screen}) {
        var data = {
            deployment: args.deployment,
            cluster: args.cluster,
            region: args.region,
            service: args.service,
            property: 'domain-name',
            value: args.value
        };

        return client.post(args.region, '/deployment-clusters/set-config', data);
    }

}
