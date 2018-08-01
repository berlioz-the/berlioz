const DateDiff = require('date-diff');

module.exports = {

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
        },
        {
            name: 'timeout',
            optional: true
        }
    ],

    exec: function({_, Promise, args, client, screen}) {
        var data = {
            deployment: args.deployment,
            cluster: args.cluster,
            region: args.region
        };

        let startDate = Date.now();
        let timeoutSec = 0;
        if (args.timeout) {
            timeoutSec = parseInt(args.timeout);
        }

        return checkIfReady();

        function checkIfReady()
        {
            return client.post('/deployment-clusters/status', data)
                .then(result => {
                    screen.table(['Deployment', 'Cluster', 'Region', 'Desired State', 'Status'])
                        .addRange(result, x => [x.deployment, x.cluster, x.region, x.state, x.status])
                        .output();

                    if (_.some(result, x => x.status != 'completed')) {

                        if (timeoutSec) {
                            var diff = new DateDiff(Date.now(), startDate);
                            screen.info('Past %s seconds...', diff.seconds())
                            if (diff.seconds() > timeoutSec) {
                                throw new Error('Process did not finish within ' + timeoutSec + ' seconds.');
                            } 
                        }

                        screen.info('Waiting...')
                        return Promise.timeout(10 * 1000)
                            .then(() => checkIfReady())
                    } else {
                        screen.info('Deployment completed.')
                    }
                });
        }
    }

}
