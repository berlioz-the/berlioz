
module.exports = {

    useLocalDeployer: true,

    arguments: [
    ],

    exec: function({_, args, screen, logger, localDeployer, Promise}) {
        const CheckRunner = require('../../../../berlioz-common/check-runner')
        var checkRunner = new CheckRunner(logger, screen);


        return Promise.resolve()
            .then(() => localDeployer.setup())
            .then(() => {
                setupGCPChecks();
                // setupAWSChecks();
            })
            .then(() => checkRunner.run())
            ;

        function setupGCPChecks()
        {
            var providerConfig = localDeployer.getProviderConfig('gcp');
            var client = localDeployer.getProviderClient('gcp');

            checkRunner.submit('GCP_ENABLED', {
                description: 'Checks if GCP provider is enabled for local deployment',
                solution: 'You can enable GCP local provider using \"berlioz local provider gcp set\". Only one (GCP/AWS) provider can be used at a time. See details at https://docs.berlioz.cloud/cli/local/#setup-using-gcp',
                precheck: () => {
                    return _.isNotNullOrUndefined(providerConfig);
                }
            });

            checkRunner.submit('GCP_API_SQL', {
                dependencies: ['GCP_ENABLED'],
                description: 'Checks if GCP Cloud SQL Admin API is enabled',
                url: 'https://docs.berlioz.cloud/cloud/gcp/api-setup/#cloud-resource-manager',
                checkCb: () => {
                    return client.Sql.queryAllInstances('local-');
                }
            });
    
            checkRunner.submit('GCP_API_PUBSUB', {
                dependencies: ['GCP_ENABLED'],
                description: 'Checks if GCP Pub/Sub API is enabled',
                url: 'https://docs.berlioz.cloud/cloud/gcp/api-setup/#cloud-resource-manager',
                checkCb: () => {
                    return client.PubSub.queryAllTopics('local-');
                }
            });
            
            checkRunner.submit('GCP_API_STORAGE', {
                dependencies: ['GCP_ENABLED'],
                description: 'Checks if GCP Cloud Storage API is enabled',
                url: 'https://docs.berlioz.cloud/cloud/gcp/api-setup/#cloud-resource-manager',
                checkCb: () => {
                    return client.Storage.queryAllBuckets('local-');
                }
            });

        }
        
        function setupAWSChecks(isEnabled)
        {
            var providerConfig = localDeployer.getProviderConfig('aws');
            var providerClient = localDeployer.getProviderClient('aws');

            checkRunner.submit('AWS_ENABLED', {
                description: 'Checks if AWS provider is enabled for local deployment',
                solution: 'You can enable AWS local provider using \"berlioz local provider aws set\". Only one (GCP/AWS) provider can be used at a time.',
                url: 'https://docs.berlioz.cloud/cli/local/#setup-using-aws',
                precheck: () => {
                    return _.isNotNullOrUndefined(providerConfig);
                }
            });
        }

    }

}
