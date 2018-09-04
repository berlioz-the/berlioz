module.exports = {

    arguments: [
        'deployment',
        'cluster',
        'region',
        'section'
    ],

    exec: function({_, args, client, screen}) {
        var configsToQuery = {};
        configsToQuery[args.section] = {};
        return Promise.resolve()
            .then(() => fetchLogs(true, configsToQuery))
            ;

        function fetchLogs(isInitial, configsToQuery)
        {
            var data = {
                cluster: args.cluster,
                deployment: args.deployment,
                region: args.region,
                configs: configsToQuery
            };

            return client.post('/process-data/fetch', data)
                .then(result => {
                    if (isInitial) {
                        screen.info('Start Date: %s', result.date);
                        screen.info('End Date: %s', result.endTime);
                    }

                    var dataRemaining = {};
                    for(var sectionName of _.keys(result.processingConfigs))
                    {
                        var sectionInfo = result.processingConfigs[sectionName];
                        if (sectionInfo.nextToken) {
                            dataRemaining[sectionName] = {
                                nextToken: sectionInfo.nextToken
                            }
                        }

                        outputConfigs(sectionInfo.data);
                    }

                    if (_.keys(dataRemaining).length > 0)
                    {
                        return fetchLogs(false, dataRemaining);
                    }
                    else
                    {
                        screen.info('All Sections: %s', result.processingConfigSections);
                    }
                })
        }


        function outputConfigs(logs)
        {
            if (_.isArray(logs)) {
                for(var x of logs) {
                    outputConfigs(x);
                }
            } else {
                screen.info(logs);
            }
        }
    }

}
