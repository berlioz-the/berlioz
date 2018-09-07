module.exports = {

    useWaiter: true,
    skipWaitFlag: true,

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
            optional: true
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
