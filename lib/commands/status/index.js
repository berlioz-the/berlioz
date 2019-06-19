
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
        screen.table()
            .column('Deployment')
            .column('Cluster')
            .autofitColumn('Region')
            .autofitColumn('Desired State')
            .autofitColumn('Status')
            .autofitColumn('Task Status')
            .autofitColumn('Pending')
            .addRange(result, x => [x.deployment, x.cluster, x.region, x.state, x.status, x.taskStatus, x.needMore])
            .output();

        for(var cd of result)
        {
            if (cd.status == 'warning' || cd.status == 'failed')
            {
                screen.error('* %s :: %s :: %s processing failed. Reason:', cd.deployment, cd.region, cd.cluster);
                var msg = cd.message;
                if (!msg) {
                    if (cd.status == 'failed') {
                        msg = 'Cluster processing failed. Contact support@berlioz.cloud for assistance.';
                    } else if (cd.status == 'warning') {
                        msg = 'There was issue with cluster processing. System will try to recover itself. Contact support@berlioz.cloud for assistance.';
                    } else {
                        msg = 'Unknown error happened.  Contact support@berlioz.cloud for assistance.';
                    }
                }
                screen.error('  %s', msg);
            }
        }
    }

}
