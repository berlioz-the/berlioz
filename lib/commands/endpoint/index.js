
module.exports = {

    useClient: true,

    arguments: [
        {
            name: 'deployment'
        },
        {
            name: 'cluster',
        },
        {
            name: 'region',
        },
        {
            name: 'endpoint',
        }
    ],

    exec: function({_, args, client, screen}) {
        var data = {
            deployment: args.deployment,
            cluster: args.cluster,
            region: args.region,
            endpoint: args.endpoint
        };

        return client.post(args.region, '/deployment-clusters/public-endpoints', data)
            .then(result => {
                for(var endpointData of result) {
                    var members = endpointData.members;
                    var member = _.head(_.values(members));
                    if (member) {
                        var url = member.protocol + '://' + member.address + ':' + member.port
                        screen.info(url);
                    }
                }
            });
    }

}
