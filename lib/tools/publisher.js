const _ = require('the-lodash');
const Promise = require('the-promise');

class Publisher
{
    constructor(logger, screen, registry, config, dataProvider, storage, shell)
    {
        this._logger = logger;
        this._screen = screen;
        this._registry = registry;
        this._config = config;
        this._dataProvider = dataProvider;
        this._storage = storage;
        this._shell = shell;
        
        this._clusterData = {};
        this._clusterVersionInfo = [];
        this._providerDeployers = {};
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

        var clusters = this._getClusters();
        for(var cluster of clusters) {
            var regionDeploymentMap = this._decidedDeployments[provider.name];
            for(var region of _.keys(regionDeploymentMap)) {
                var repoDict = this._getClusterRegionData(cluster.name, region);
                var deployments = regionDeploymentMap[region];
                for(var deployment of deployments)
                {
                    if (!(deployment in repoDict)) {
                        repoDict[deployment] = {};
                    }
                }
            }
        }

        var deployer = this._getDeployer(provider.kind);
        return this._processDeployer(deployer, provider, regions);
    }

    _processDeployer(deployer, provider, regions)
    {
        this.logger.info("[_processDeployer] regions: ", regions);
        var regionClients = {};
        return Promise.resolve()
            .then(() => {
                if (!deployer.executeLegacy) {
                    return;
                }
                return deployer.executeLegacy(provider, regions);
            })
            .then(() => {
                return Promise.serial(regions, region => {
                    if (!deployer.fetchRegionClient) {
                        regionClients[region] = null;
                        return;
                    } else {
                        return Promise.resolve(deployer.fetchRegionClient(provider, region))
                            .then(result => {
                                regionClients[region] = result;
                            });
                    }
                })
            })
            .then(() => {
                return Promise.serial(this._getClusters(), x => this._deployCluster(deployer, provider, regions, regionClients, x))
            })
    }

    _deployCluster(deployer, provider, regions, regionClients, cluster)
    {
        return Promise.resolve()
            .then(() => {
                var services = cluster.services;
                if (this._targetService) {
                    services = services.filter(x => x.name == this._targetService);
                }
                if (services.length == 0) {
                    return;
                }
                return Promise.resolve()
                    .then(() => this._prepareDeployServices(deployer, provider, regions, regionClients, cluster))
                    .then(() => Promise.serial(services, x => this._deployService(deployer, provider, regions, regionClients, x)));
            })
            .then(() => {
                var lambdas = cluster.lambdas;
                if (lambdas.length == 0) {
                    return;
                }
                return Promise.serial(lambdas, x => this._deployLambda(deployer, provider, regions, regionClients, x))
            })
            .then(() => {
                var databases = cluster.databases;
                databases = databases.filter(x => x.className == 'sql');
                databases = databases.filter(x => x.hasInitScript);
                if (databases.length == 0) {
                    return;
                }
                return Promise.serial(databases, x => this._deployDatabase(deployer, provider, regions, regionClients, x))
            })
            
    }

    _prepareDeployServices(deployer, provider, regions, regionClients, cluster)
    {
        this.logger.info("[_prepareDeployServices] %s...", cluster.id);
        return Promise.resolve()
            .then(() => {
                if (!deployer.prepareDeployServices) {
                    return;
                }
                return deployer.prepareDeployServices(provider, cluster, regions, regionClients);
            })
    }

    _deployService(deployer, provider, regions, regionClients, service)
    {
        this.logger.info("[_deployService] %s...", service.id);
        
        var imageInfo = this._config.get('repository', [service.naming[0], service.id])
        if (!imageInfo) {
            throw new Error(`Image for ${service.id} is not built`);
        }

        return Promise.resolve()
            .then(() => {
                if (!deployer.deployService) {
                    return;
                }
                return deployer.deployService(provider, service, imageInfo)
                    .then(repoInfo => {
                        this._registerEntityRepoInfo(service, provider, regions, repoInfo);
                    });
            })
            .then(() => {
                return Promise.serial(regions, x => 
                    this._deployServiceToRegion(
                        deployer, 
                        provider,
                        service,
                        imageInfo,
                        x,
                        regionClients[x])
                )
            })
    }

    _deployServiceToRegion(deployer, provider, service, imageInfo, region, client)
    {
        this.logger.info("[_deployServiceToRegion] %s => %s...", service.id, region);
        if (!deployer.deployServiceToRegion) {
            return;
        }

        return Promise.resolve(deployer.deployServiceToRegion(provider, service, imageInfo, region, client))
            .then(repoInfo => {
                this._registerEntityRegionalRepoInfo(service, provider, region, repoInfo)
            });
    }
    
    _deployLambda(deployer, provider, regions, regionClients, lambda)
    {
        this.logger.info("[_deployLambda] %s...", lambda.id);

        var imageInfo = this._config.get('repository', [lambda.naming[0], lambda.id])
        if (!imageInfo) {
            throw new Error(`Image for lambda ${lambda.id} is not built`);
        }

        return Promise.resolve()
            .then(() => {
                if (!deployer.deployLambda) {
                    return;
                }
                return deployer.deployLambda(provider, lambda, imageInfo)
                    .then(repoInfo => {
                        this._registerEntityRepoInfo(lambda, provider, regions, repoInfo);
                    });
            })
            .then(() => {
                return Promise.serial(regions, x => 
                    this._deployLambdaToRegion(
                        deployer, 
                        provider, 
                        lambda, 
                        imageInfo,
                        x,
                        regionClients[x])
                )
            })
    }

    _deployLambdaToRegion(deployer, provider, lambda, imageInfo, region, client)
    {
        this.logger.info("[_deployLambdaToRegion] %s => %s...", lambda.id, region);
        if (!deployer.deployLambdaToRegion) {
            return;
        }
        return Promise.resolve(deployer.deployLambdaToRegion(provider, lambda, imageInfo, region, client))
            .then(repoInfo => {
                this._registerEntityRegionalRepoInfo(lambda, provider, region, repoInfo)
            });
    }

    _deployDatabase(deployer, provider, regions, regionClients, database)
    {
        this.logger.info("[_deployDatabase] %s...", database.id);

        var imageInfo = this._config.get('repository', [database.naming[0], database.id])
        if (!imageInfo) {
            return;
        }

        return Promise.resolve()
            .then(() => {
                if (!deployer.deployDatabase) {
                    return;
                }
                return deployer.deployDatabase(provider, database, imageInfo)
                    .then(repoInfo => {
                        this._registerEntityRepoInfo(database, provider, regions, repoInfo);
                    });
            })
            .then(() => {
                return Promise.serial(regions, x => 
                    this._deployDatabaseToRegion(
                        deployer, 
                        provider, 
                        database, 
                        imageInfo,
                        x,
                        regionClients[x])
                )
            })
    }

    _deployDatabaseToRegion(deployer, provider, database, imageInfo, region, client)
    {
        this.logger.info("[_deployDatabaseToRegion] %s => %s...", database.id, region);
        if (!deployer.deployDatabaseToRegion) {
            return;
        }
        return Promise.resolve(deployer.deployDatabaseToRegion(provider, database, imageInfo, region, client))
            .then(repoInfo => {
                this._registerEntityRegionalRepoInfo(database, provider, region, repoInfo)
            });
    }

    _registerEntityRepoInfo(entity, provider, regions, repoInfo)
    {
        this.logger.info("[_registerEntityRepoInfo] %s Repo Info:", entity.id, repoInfo);
        if (!repoInfo) {
            throw new Error(`Failed to push image for ${entity.id}`)
        }

        var regionDeploymentMap = this._decidedDeployments[provider.name];
        for(var region of _.keys(regionDeploymentMap))
        {
            var repoDict = this._getClusterRegionData(entity.clusterName, region);
            var deployments = regionDeploymentMap[region];
            for(var deployment of deployments)
            {
                if (!(deployment in repoDict)) {
                    repoDict[deployment] = {};
                }
            }
            var deployments = regionDeploymentMap[region];
            this._registerRepoInfo(entity, region, deployments, repoInfo);
        }
    }

    _registerEntityRegionalRepoInfo(entity, provider, region, repoInfo)
    {
        this.logger.info("[_registerEntityRegionalRepoInfo] %s, Region: %s, Repo Info:", entity.id, region, repoInfo);
        if (!repoInfo) {
            throw new Error(`Failed to push image for ${entity.id}`)
        }

        var regionDeploymentMap = this._decidedDeployments[provider.name];
        var deployments = regionDeploymentMap[region];
        this._registerRepoInfo(entity, region, deployments, repoInfo);
    }

    _getClusterRegionData(clusterName, region)
    {
        this._logger.info("[_getClusterRegionData] %s => %s...", clusterName, region)
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

    _getDeployer(kind)
    {
        if (kind in this._providerDeployers) {
            return this._providerDeployers[kind];
        }

        if (kind == 'aws') {
            const PublisherAws = require('./publisher-aws');
            var publisher = new PublisherAws(this._logger.sublogger('PublisherAws'), this._screen, this);
            this._providerDeployers[kind] = publisher;
            return this._providerDeployers[kind];
        }

        if (kind == 'gcp') {
            const PublisherGcp = require('./publisher-gcp');
            var publisher = new PublisherGcp(this._logger.sublogger('PublisherGcp'), this._screen, this);
            this._providerDeployers[kind] = publisher;
            return this._providerDeployers[kind];
        }

        throw new Error(`Provider ${kind} not supported.`);
    }

    _registerRepoInfo(entity, region, deployments, repoInfo)
    {
        var repoDict = this._getClusterRegionData(entity.clusterName, region);
        for(var deployment of deployments)
        {
            var deploymentData = repoDict[deployment];
            if (!deploymentData) {
                this._logger.error("Deployment %s not found. RepoDict: ", deployment, repoDict);
                throw new Error(`Deployment ${deployment} not found`);
            }
            deploymentData[entity.id] = repoInfo;
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
        return this._dataProvider.publishClusterDeploymentData(region, data)
            .then(result => {
                this._clusterVersionInfo.push(result);
            });
    }


}

module.exports = Publisher;
