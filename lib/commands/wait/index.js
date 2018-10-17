module.exports = {

    useWaiter: true,
    skipWaitFlag: true,
    useClient: true,

    arguments: [
        {
            name: 'deployment',
            optional: true
        },
        {
            name: 'cluster',
            optional: true
        },
        {
            name: 'region',
            optional: false
        }
    ],

    exec: function({_, Promise, args, client, screen, waiter}) {
        var data = {
            deployment: args.deployment,
            cluster: args.cluster,
            region: args.region
        };
        return waiter.perform(data)
    }

}
