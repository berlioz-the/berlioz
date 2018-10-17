const _ = require('the-lodash');
const Promise = require('the-promise');
const Errors = require('./errors');

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

    setVersion(value)
    {
        this._version = value;
    }

    setVersionMetadata(value)
    {
        this._versionMetadata = value;
    }

    perform()
    {
        this._logger.info('VersionMetadata: ', this._versionMetadata);

        if (!this._region) {
            throw new Error('Region not set.');
        }
        
        if (this._version)
        {
            if (this._versionMetadata) {
                throw new Error('When specifying particular version, cannot use version metadata.');
            }
        }

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
        return this._client.get(this._region, '/deployment/' + this._deploymentName)
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
            deployment: this._deploymentName,
            region: this._region
        };
        if (this._cluster) {
            data.cluster = this._cluster;
        }
        return this._client.post(this._region, '/deployment-clusters/fetch', data)
            .then(result => {
                if (result.length == 0) {
                    throw new Errors.Input('No clusters found matching the request');
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
            var targetVersion = this._getTargetVersion(deploymentCluster);
            this._logger.info('Setting up version for deployment %s, cluster %s, region %s, version = %s', deploymentCluster.deployment, deploymentCluster.cluster, deploymentCluster.region, targetVersion);
            if (!targetVersion) {
                throw new Error('Could not decide target version for cluster deployment: ' + deploymentCluster.full_name)
            }
            if (this._force || 
                (deploymentCluster.targetVersion != targetVersion) || 
                (deploymentCluster.state != this._targetState))
            {
                deploymentCluster.newTargetVersion = targetVersion;
                this._toBeDeployedClusters.push(deploymentCluster);
            }
        }
    }

    _getTargetVersion(deploymentCluster)
    {
        var targetVersion;
        if (this._versionMetadata) {
            var versionInfo = _.find(this._versionMetadata, x => x.deployment == deploymentCluster.deployment && x.cluster == deploymentCluster.cluster && x.region == deploymentCluster.region);
            if (!versionInfo) {
                throw new Error('Version metadata not present for cluster deployment: ' + deploymentCluster.full_name)
            }
            return versionInfo.date;
        }
        else if (this._version) {
            targetVersion = this._version;
        } else {
            targetVersion = deploymentCluster.latestVersion;
        }
        return targetVersion;
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
        var changes = [];
        if (clusterDeployment.state != this._targetState)
        {
            changes.push(['state', clusterDeployment.state, this._targetState]);
        }
        if (clusterDeployment.targetVersion != clusterDeployment.newTargetVersion)
        {
            changes.push(['version', clusterDeployment.targetVersion, clusterDeployment.newTargetVersion]);
        }
        return changes.map(x => x[0] + ' : ' + x[1] + ' => ' + x[2]).join(', ');
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
        return this._client.post(this._region, '/deployment-clusters/setupVersion', data)
            .then(result => {
                this._logger.verbose('process result: ', result);
                this._screen.info('Submitted cluster %s %s at %s.', result.cluster, result.state, result.region);
            });
    }

}

module.exports = Deployer;
