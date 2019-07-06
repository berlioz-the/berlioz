const _ = require('the-lodash');
const Promise = require('the-promise');

class GcpHelper
{
    constructor(logger, screen, dataProvider, inputError, shell, storage)
    {
        this._logger = logger;
        this._screen = screen;
        this._dataProvider = dataProvider;
        this._inputError = inputError;
        this._shell = shell;
        this._storage = storage;
    }

    get logger() {
        return this._logger;
    }

    get screen() {
        return this._screen;
    }

    get shell() {
        return this._shell;
    }

    gcloudAuthorize(deploymentName)
    {
        var authResult = {

        };
        var deployment = null;
        var provider = null;
        return Promise.resolve()
            .then(() => this._dataProvider.getDeployment(deploymentName))
            .then(result => {
                if (!result) {
                    this._inputError(`Unknown deployment ${deploymentName}`);
                }
                deployment = result;
                return this._dataProvider.getProvider(deployment.provider);
            })
            .then(result => {
                if (!result) {
                    this._inputError(`Could not fetch provider ${deployment.provider}`);
                }
                provider = result;
                if (provider.kind != 'gcp') {
                    this._inputError(`Only GCP providers supported at this point.`);
                }

                authResult.project_id = provider.credentials.project_id;

                var keyContent = JSON.stringify(provider.credentials, null, 4);
                return Promise.resolve()
                    .then(() => this._storage.writeToTmpConfigFile('gcp-key.json', keyContent))
                    .then(filePath => {
                        return this._shell.runGCloud(['auth', 'activate-service-account', '--key-file', filePath]);
                    })
            })
            .then(() => authResult);
    }

    kubernetesResize(deploymentName, regionOrZone, size)
    {
        return this.gcloudAuthorize(deploymentName)
            .then(authResult => {
                var k8sClusterName = this.getMyK8sClusterName(deploymentName, regionOrZone);
                var gcloudArgs = ['container', 'clusters', 'resize', k8sClusterName];
                gcloudArgs = _.concat(gcloudArgs, this.getZoneParams(regionOrZone));
                gcloudArgs = _.concat(gcloudArgs, ['--project', authResult.project_id]);
                gcloudArgs = _.concat(gcloudArgs, ['--node-pool', 'default-pool']);
                gcloudArgs = _.concat(gcloudArgs, ['--size', size]);
                gcloudArgs = _.concat(gcloudArgs, ['--quiet']);
                return this._shell.runGCloud(gcloudArgs);
            })
    }

    getZoneParams(regionOrZone)
    {
        var region = this._getRegion(regionOrZone);
        if (regionOrZone == region) {
            return ['--region', regionOrZone];
        } else {
            return ['--zone', regionOrZone];
        }
    }

    getMyK8sClusterName(deploymentName, regionOrZone)
    {
        var shortRegion = regionOrZone.replace(/-/g, "");
        var k8sClusterName = `${deploymentName}-${shortRegion}`;
        return k8sClusterName
    }

    _getRegion(regionOrZone)
    {
        var index = regionOrZone.split('-', 2).join('-').length;
        return regionOrZone.substr(0, index);
    }
}

module.exports = GcpHelper;