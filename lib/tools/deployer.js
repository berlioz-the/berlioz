const _ = require('the-lodash');
const Promise = require('the-promise');

class Deployer
{
    constructor(logger, screen, client, targetState, deployment)
    {
        this._logger = logger;
        this._screen = screen;
        this._client = client;
        this._deploymentName = deployment;
        this._toBeDeployedClusters = [];
        this._force = false;
        this._targetState = targetState;
    }

    setForceDeploy()
    {
        this._force = true;
    }

    setRegion(value)
    {
        this._region = value;
    }

    setCluster(value)
    {
        this._cluster = value;
    }

    perform()
    {
        return Promise.resolve()
            .then(() => this._queryDeployment())
            .then(() => this._queryClusters())
            .then(() => this._setupTargetVersions())
            .then(() => this._outputChangesToBeMade())
            .then(() => this._processChanges())
            ;
    }

    _queryDeployment()
    {
        this._deployments = [];
        return this._client.get('/deployment/' + this._deploymentName)
            .then(result => {
                if (result) {
                    this._deployments.push(result);
                }
                this._logger.info('DEPLOYMENTS: ', this._deployments);
            });
    }

    _queryClusters()
    {
        var data = {
            deployment: this._deploymentName
        };
        if (this._cluster) {
            data.cluster = this._cluster;
        }
        if (this._region) {
            data.region = this._region;
        }
        return this._client.post('/deployment-clusters/fetch', data)
            .then(result => {
                if (result.length == 0) {
                    throw new Error('No clusters found matching the request');
                }
                this._deploymentClusters = result;
                this._screen.header('CLUSTERS MATCHING SEARCH CRITERIA');
                this._screen.table(['Deployment', 'Cluster', 'Region', 'Latest Version', 'Target Version', 'Current Version'])
                    .addRange(result, x => [x.deployment, x.cluster, x.region, x.latestVersion, x.targetVersion, x.currentVersion])
                    .output();
            });
    }

    _setupTargetVersions()
    {
        for(var deploymentCluster of this._deploymentClusters)
        {
            var targetVersion = deploymentCluster.latestVersion;
            if (this._force || (deploymentCluster.targetVersion != targetVersion) || (deploymentCluster.state != this._targetState))
            {
                deploymentCluster.newTargetVersion = targetVersion;
                this._toBeDeployedClusters.push(deploymentCluster);
            }
        }
    }

    _outputChangesToBeMade()
    {
        if (this._toBeDeployedClusters.length == 0) {
            this._screen.info('No changes are to be made.');
        }
        this._screen.header('CLUSTERS MATCHING SEARCH CRITERIA');
        this._screen.table(['Deployment', 'Cluster', 'Region', 'Changes'])
            .addRange(this._toBeDeployedClusters, x => [x.deployment, x.cluster, x.region, this._getChangeString(x)])
            .output();
    }

    _getChangeString(clusterDeployment)
    {
        if (clusterDeployment.state != this._targetState) {
            return 'none => ' + clusterDeployment.newTargetVersion;
        }
        if (!clusterDeployment.targetVersion) {
            return 'none => ' + clusterDeployment.newTargetVersion;
        }
        return clusterDeployment.targetVersion + ' => ' + clusterDeployment.newTargetVersion;
    }


    _processChanges()
    {
        return Promise.serial(this._toBeDeployedClusters, x => this._processClusterDeployment(x));
    }

    _processClusterDeployment(clusterDeployment)
    {
        var data = {
            cluster: clusterDeployment.cluster,
            deployment: clusterDeployment.deployment,
            region: clusterDeployment.region,
            targetVersion: clusterDeployment.newTargetVersion,
            state: this._targetState,
            force: this._force
        };
        return this._client.post('/deployment-clusters/setupVersion', data)
            .then(result => {
                this._screen.info(result);
            });
    }

}

module.exports = Deployer;
