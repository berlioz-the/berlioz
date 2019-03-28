
module.exports = {

    useClient: true,

    arguments: [
        'deployment',
        {
            name: 'cluster',
            optional: false
        },
        {
            name: 'region',
            optional: false
        },
        {
            name: 'versionKind',
            optional: true
        },
        {
            name: 'version',
            optional: true
        }
    ],

    fetch: function({_, args, client, screen}) {
        var data = {
            deployment: args.deployment,
            region: args.region,
            cluster: args.cluster
        };
        return client.post(args.region, '/deployment-clusters/fetch', data)
            .then(clusterDeployments => {
                if (clusterDeployments.length == 0) {
                    return null;
                }
                var clusterDeployment = _.head(clusterDeployments);
                var version = args.version;
                if (!version) {
                    if (args.versionKind == 'latest') {
                        version = clusterDeployment.latestVersion;
                    } else if (args.versionKind == 'current') {
                        version = clusterDeployment.currentVersion;
                    }
                }
                if (!version) {
                    throw new Error('Version is not set');
                }

                data.version = version;
                return client.post(args.region, '/deployment-data/fetch', data)
                    .then(result => {
                        if (result) {
                            if (result.definition) {
                                return result.definition;
                            }
                        }
                        return null;
                    })
            })
    },

    exec: function({screen, result}) {
        for(var x of result)
        {
            screen.info(x);
        }
    }

}
