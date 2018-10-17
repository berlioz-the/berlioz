
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
        'property',
        'value'
    ],

    exec: function({_, args, client, screen}) {
        var data = {
            deployment: args.name,
            cluster: args.cluster,
            region: args.region,
            service: args.service,
            endpoint: args.endpoint,
            property: args.property,
            value: args.value
        };

        return client.post(args.region, '/deployment-clusters/set-config', data);
    }

}
