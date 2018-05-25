
module.exports = {

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
            optional: true
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

        return client.post('/deployment-clusters/set-config', data);
    }

}
