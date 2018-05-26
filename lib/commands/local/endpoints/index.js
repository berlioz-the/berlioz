
module.exports = {

    useLocalDeployer: true,

    arguments: [
        {
            name: 'cluster',
            optional: true,
            autocomplete_target: 'local-cluster'
        }
    ],

    exec: function({_, args, screen, config}) {

        if (args.cluster)
        {
            return outputClusterEndpoints(args.cluster);
        }
        else
        {
            var clusterMap = config.repoStore.get('local-endpoints-public', []);
            for(var cluster of _.keys(clusterMap))
            {
                outputClusterEndpoints(cluster);
            }
            return;
        }

        function outputClusterEndpoints(cluster)
        {
            var clusterEndpointMap = config.repoStore.get('local-endpoints-public', [cluster]);
            if (clusterEndpointMap)
            {
                for(var endpointName of _.keys(clusterEndpointMap))
                {
                    outputEndpoints(cluster, endpointName, clusterEndpointMap[endpointName])
                }
            }
        }

        function outputEndpoints(cluster, endpoint, entryMap)
        {
            screen.header('Cluster %s, Endpoint: %s', cluster, endpoint);
            screen.table(['Protocol', 'Address', 'Port'])
                .addRange(_.values(entryMap), x => [x.protocol, x.address, x.port])
                .output();
        }
    }

}
