
module.exports = {

    useWaiter: true,
    useClient: true,

    arguments: [
        'deployment',
        'cluster',
        'region',
        'service',
        'value'
    ],

    exec: function({_, args, client, screen, waiter}) {
        var data = {
            deployment: args.deployment,
            cluster: args.cluster,
            region: args.region,
            service: args.service,
            property: 'task-count',
            value: args.value
        };

        return client.post(args.region, '/deployment-clusters/set-config', data)
            .then(() => waiter.perform({
                deployment: args.deployment,
                cluster: args.cluster,
                region: args.region
            }));
    }

}
