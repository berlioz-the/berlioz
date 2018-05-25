
module.exports = {

    arguments: [
        {
            name: 'name',
            autocomplete_target: 'deployment'
        },
        'cluster',
        'region',
        'service',
        'value'
    ],

    exec: function({_, args, client, screen}) {
        var data = {
            deployment: args.name,
            cluster: args.cluster,
            region: args.region,
            service: args.service,
            property: 'task-count',
            value: args.value
        };

        return client.post('/deployment-clusters/set-config', data);
    }

}
