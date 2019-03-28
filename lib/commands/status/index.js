
module.exports = {

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

    flags: [
        'json'
    ],

    fetch: function({args, client, screen}) {
        var data = {
            deployment: args.deployment,
            cluster: args.cluster,
            region: args.region
        };

        return client.post(args.region, '/deployment-clusters/status', data);
    },

    exec: function({_, args, client, screen, result}) {
        if (args.json) {
            screen.info(JSON.stringify(result));
            return result;
        }
        screen.table(['Deployment', 'Cluster', 'Region', 'Desired State', 'Status', 'Task Status', 'Pending'])
            .addRange(result, x => [x.deployment, x.cluster, x.region, x.state, x.status, x.taskStatus, x.needMore])
            .output();
    }

}
