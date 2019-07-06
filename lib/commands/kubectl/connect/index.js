module.exports = {

    useClient: true,

    arguments: [
        "region",
        "deployment",
    ],

    exec: function({args, dataProvider, logger, screen, Promise, inputError, shell, storage}) {

        var deployment = null;
        var provider = null;
        return Promise.resolve()
            .then(() => {
                return dataProvider.getDeployment(args.deployment);
            })
            .then(result => {
                if (!result) {
                    inputError(`Unknown deployment ${args.deployment}`);
                }
                deployment = result;
                return dataProvider.getProvider(deployment.provider);
            })
            .then(result => {
                if (!result) {
                    inputError(`Could not fetch provider ${deployment.provider}`);
                }
                provider = result;
                if (provider.kind != 'gcp') {
                    inputError(`Only GCP providers supported at this point.`);
                }

                var keyContent = JSON.stringify(provider.credentials, null, 4);
                return Promise.resolve()
                    .then(() => storage.writeToTmpConfigFile('gcp-key.json', keyContent))
                    .then(filePath => {
                        return shell.runGCloud(['auth', 'activate-service-account', '--key-file', filePath]);
                    })
                    .then(() => {
                        var shortRegion = args.region.replace(/-/g, "");
                        var k8sClusterName = `${deployment.name}-${shortRegion}`;
                        return shell.runGCloud(['container', 'clusters', 'get-credentials', k8sClusterName, '--zone', args.region, '--project', provider.credentials.project_id]);
                    })
            })
            ;
    }

}
