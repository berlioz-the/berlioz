const _ = require('the-lodash');
const Promise = require('the-promise');

class Publisher
{
    constructor(logger, screen, registry, config, dataProvider, storage)
    {
        this._logger = logger;
        this._screen = screen;
        this._registry = registry;
        this._config = config;
        this._dataProvider = dataProvider;
        this._storage = storage;
        
        this._clusterData = {};
        this._clusterVersionInfo = [];
        this._providerDeployers = {
            aws: this._deployToAws.bind(this),
            gcp: this._deployToGcp.bind(this)
        }
    }

    setRegion(value)
    {
        this._region = value;
    }

    setTargetCluster(value)
    {
        this._targetCluster = value;
    }

    setTargetDeployment(value)
    {
        this._targetDeployment = value;
    }

    setTargetImage(value)
    {
        this._targetImage = value;
    }

    perform()
    {
        if (!this._region) {
            throw new Error('Region not set.');
        }
        
        return Promise.resolve()
            .then(() => this._queryDeployments())
            .then(() => this._queryProviders())
            .then(() => this._decideDeployments())
            .then(() => this._setupClusterMap())
            .then(() => this._processDeployments())
            .then(() => this._publishClusterData())
            .then(() => {
                this._logger.info('Cluster Versions: ', this._clusterVersionInfo)
                return this._clusterVersionInfo;
            })
            ;
    }

    _queryDeployments()
    {
        return this._dataProvider.getDeployments()
            .then(result => {
                this._deployments = {};
                for(var x of result) {
                    if (this._targetDeployment) {
                        if (this._targetDeployment != x.name) {
                            continue;
                        }
                    }
                    this._deployments[x.name] = x;
                }
                this._logger.info('DEPLOYMENTS: ', this._deployments);
            });
    }

    _queryProviders()
    {
        return this._dataProvider.getProviders()
            .then(result => {
                this._providers = {};
                for(var x of result) {
                    this._providers[x.name] = x;
                }
                this._logger.info('PROVIDERS: ', this._providers);
            });
    }

    _decideDeployments()
    {
        this._decidedDeployments = {};
        for(var deployment of _.values(this._deployments))
        {
            this._logger.info('Deployment: ', deployment);
            if (!(deployment.provider in this._decidedDeployments))
            {
                this._decidedDeployments[deployment.provider] = {};
            }
            if (!(this._region in this._decidedDeployments[deployment.provider]))
            {
                this._decidedDeployments[deployment.provider][this._region] = [];
            }
            this._decidedDeployments[deployment.provider][this._region].push(deployment.name);
        }
        this._logger.info('DECIDED DEPLOYMENTS: ', this._decidedDeployments);
    }

    _setupClusterMap()
    {
        var clusters = this._registry.clusters;
        if (this._targetCluster) {
            clusters = clusters.filter(x => x.name == this._targetCluster);
        }

        for(var cluster of clusters)
        {
            var clusterDefinitions = cluster.extractDefinitions()
            // TODO: can limit by cluster
            var policyDefinitions = this._registry.extractPolicies()
            var definitions = _.concat(clusterDefinitions, policyDefinitions)

            var clusterInfo = {
                name: cluster.name,
                cluster: cluster,
                definition: definitions,
                regions: {}
            };

            this._clusterData[cluster.name] = clusterInfo;
        }
    }

    _processDeployments()
    {
        return Promise.serial(_.keys(this._decidedDeployments), x => this._deployToProvider(x));
    }

    _deployToProvider(providerName)
    {
        this._logger.info('[_deployToProvider] %s... ', providerName);
        var provider = this._providers[providerName];

        var regionDeploymentMap = this._decidedDeployments[providerName];
        var regions = _.keys(regionDeploymentMap);
        regions = regions.filter(x => this._config.get('global', ['providerMapping', x]) == provider.kind);
        if (regions.length == 0) {
            this._logger.info('[_deployToProvider] %s no valid regions selected.', providerName);
            return;
        }

        var deployer = this._providerDeployers[provider.kind];
        if (!deployer) {
            throw new Error('Provider ' + provider.kind + ' is not supported.');
        }
        return deployer(provider, regions);
    }
    
    _getClusterRegionData(clusterName, region)
    {
        var dict = this._clusterData[clusterName].regions;
        if (!(region in dict)) {
            dict[region] = {};
        }
        return dict[region];
    }

    _getClusters()
    {
        var clusters = _.values(this._clusterData).map(x => x.cluster);
        return clusters;
    }

    _deployToGcp(provider, regions)
    {
        this._logger.info("[_deployToGcp] %s...", provider.name);
        
        const PublisherGcp = require('./publisher-gcp');
        var publisher = new PublisherGcp(this._logger, this._screen, this);
        return publisher.execute(provider, regions);
    }

    _deployToAws(provider, regions)
    {
        this._logger.info("[_deployToAws] %s...", provider.name);

        const PublisherAws = require('./publisher-aws');
        var publisher = new PublisherAws(this._logger, this._screen, this);
        return publisher.execute(provider, regions);
    }

    _registerLambdaInfo(lambda, region, deployments, repoInfo)
    {
        var repoDict = this._getClusterRegionData(lambda.clusterName, region);
        for(var deployment of deployments)
        {
            var deploymentData = repoDict[deployment];
            if (!deploymentData.lambdas) {
                deploymentData.lambdas = {}
            }
            deploymentData.lambdas[lambda.id] = repoInfo;
        }
    }

    _registerServiceInfo(service, region, deployments, repoInfo)
    {
        var repoDict = this._getClusterRegionData(service.clusterName, region);
        for(var deployment of deployments)
        {
            var deploymentData = repoDict[deployment];
            if (!deploymentData) {
                this._logger.error("Deployment %s not found. RepoDict: ", deployment, repoDict);
                throw new Error("Deployment not found: " + deployment);
            }
            if (!deploymentData.services) {
                deploymentData.services = {}
            }
            deploymentData.services[service.id] = repoInfo;
        }
    }

    _publishClusterData()
    {
        // this._logger.info('PUBLISH REPO DATA', this._clusterData);

        return Promise.serial(_.values(this._clusterData), clusterInfo => {

            return Promise.serial(_.keys(clusterInfo.regions), region => {

                return Promise.serial(_.keys(clusterInfo.regions[region]), deployment => {

                    var repoInfo = clusterInfo.regions[region][deployment];
                    return this._publishCluster(clusterInfo, region, deployment, repoInfo);

                });

            });

        });
    }

    _publishCluster(clusterInfo, region, deployment, repoInfo)
    {
        this._logger.info('[_publishCluster]. Cluster=%s, Deployment=%s, Region=%s, Repositories:', 
            clusterInfo.name, 
            deployment, 
            region, 
            repoInfo);

        var data = {
            cluster: clusterInfo.name,
            deployment: deployment,
            region: region,
            definition: clusterInfo.definition,
            repositories: repoInfo
        };
        return this._dataProvider.publishClusterDeploymentData(data)
            .then(result => {
                this._clusterVersionInfo.push(result);
            });
    }


}

module.exports = Publisher;
