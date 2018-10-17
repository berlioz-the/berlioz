const fs = require('fs');
const _ = require('the-lodash');
const Promise = require('the-promise');
const AWSClient = require('aws-sdk-wrapper');
const ArnParser = require('aws-arn-parser');

class Publisher
{
    constructor(logger, screen, registry, config, dataProvider)
    {
        this._logger = logger;
        this._screen = screen;
        this._registry = registry;
        this._config = config;
        this._dataProvider = dataProvider;
        this._clusterData = {};
        this._clusterVersionInfo = [];
        this._accountId = null;
    }

    setRegion(value)
    {
        this._region = value;
    }

    setTargetCluster(value)
    {
        this._targetCluster = value;
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
        return Promise.serial(regions, x => this._deployToRegion(provider, x, regionDeploymentMap[x]));
    }

    _deployToRegion(provider, region, deployments)
    {
        this._logger.info('DEPLOYMENT to %s :: %s. Deployments: ... ', provider.name, region, deployments);
        var credentialsConfig = {
                key: provider.key,
                secret: provider.secret
            };
        var aws = new AWSClient(region, credentialsConfig, this._logger.sublogger('AWSClient'));

        return Promise.resolve()
            .then(() => {
                return aws.User.queryCurrent()
                    .then(user => {
                        var userArn = ArnParser(user.Arn);
                        this._accountId = userArn.namespace;
                    });
            })
            .then(() => {
                var clusters = _.values(this._clusterData).map(x => x.cluster);
                return Promise.serial(clusters, x => this._deployClusterToRegion(x, aws, region, deployments));
            });
    }

    _getClusterRegionData(clusterName, region)
    {
        var dict = this._clusterData[clusterName].regions;
        if (!(region in dict)) {
            dict[region] = {};
        }
        return dict[region];
    }

    _deployClusterToRegion(cluster, aws, region, deployments)
    {
        this._logger.info('_deployClusterToRegion :: %s', cluster.name);

        var repoDict = this._getClusterRegionData(cluster.name, region);
        for(var deployment of deployments)
        {
            if (!(deployment in repoDict)) {
                repoDict[deployment] = {};
            }
        }

        var berliozBucketInfo = null;
        return Promise.resolve()
            .then(() => aws.S3.createBucket(this._accountId + '-berlioz-image-store-' + cluster.name + '-' + region))
            .then(result => {
                berliozBucketInfo = result;
            })
            .then(() => {
                var services = cluster.services;
                if (this._targetService) {
                    services = services.filter(x => x.name == this._targetService);
                }
                return Promise.serial(services, x => this._deployServiceToRegion(cluster, x, aws, region, deployments))
            })
            .then(() => {
                var images = this._registry.images;
                images = images.filter(x => x.isSignificant);
                if (this._targetImage) {
                    images = images.filter(x => x.name == this._targetImage);
                }
                return Promise.serial(images, x => this._deployImageToRegion(cluster, x, aws))
            })
            .then(() => {
                var lambdas = cluster.lambdas;
                return Promise.serial(lambdas, x => this._deployLambdaToRegion(cluster, x, aws, berliozBucketInfo, deployments))
            })
            ;
    }

    _deployLambdaToRegion(cluster, lambda, aws, berliozBucketInfo, deployments)
    {
        this._logger.info('[_deployLambdaToRegion] %s... ', lambda.id);
        this._screen.info('Uploading %s to %s...', lambda.id, aws.region)

        var lambdaInfo = this._config.get('repository', [lambda.naming[0], lambda.id])
        if (!lambdaInfo) {
            throw new Error('Code for ' + lambda.id + ' is not built.');
        }
        this._logger.info('[_deployLambdaToRegion] %s, info:', lambda.id, lambdaInfo);

        var pathNaming = _.clone(lambda.naming);
        pathNaming.push(lambdaInfo.digest);
        var keyPath = pathNaming.join('/');
        return aws.S3.getObjectMetadata(berliozBucketInfo.Bucket, keyPath)
            .then(result => {
                if (result) {
                    return;
                }
                var stream = fs.createReadStream(lambdaInfo.path)
                return aws.S3.upload(berliozBucketInfo.Bucket, keyPath, stream);
            })
            .then(() => {
                var remoteLambdaInfo = {
                    bucket: berliozBucketInfo.Bucket,
                    key: keyPath,
                    region: aws.region
                }
                return this._registerLambdaInfo(lambda, aws.region, deployments, remoteLambdaInfo)
            })
        
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

    _deployServiceToRegion(cluster, service, aws, region, deployments)
    {
        if (service.definition.code) {
            if (service.definition.code.image) {
                return;
            }
        }
        this._logger.info('_deployServiceToRegion :: %s to %s', service.name, aws.region);
        var imageInfo = this._config.get('repository', [service.naming[0], service.id])
        if (!imageInfo) {
            throw new Error('Image for ' + service.id + ' is not built.');
        }
        var repoName = imageInfo.name;
        return this._deployImage(imageInfo.name, repoName, aws)
            .then(repoInfo => this._registerRepoInfo(service, region, deployments, repoInfo))
    }

    _deployImageToRegion(cluster, image, aws)
    {
        this._logger.info('_deployImageToRegion :: %s to %s', image.name, aws.region);
        var imageInfo = this._config.get('repository', [item.naming[0], item.id])
        if (!imageInfo) {
            throw new Error('Image for ' + image.id + ' is not built.');
        }
        var repoName = imageInfo.name;
        return this._deployImage(imageInfo.name, repoName, aws)
            .then(repoInfo => {
                this._logger.info('_deployImageToRegion. Result: ', repoInfo);
            })
    }

    _deployImage(imageName, repoName, aws)
    {
        this._logger.info('_deployImage  %s to %s at %s...', imageName, repoName, aws.region);
        var repo = null;
        var repoInfo = {

        };
        return aws.Repository.fetch(repoName)
            .then(repo => {
                repoInfo.repositoryArn = repo.repositoryArn;
                repoInfo.repositoryUri = repo.repositoryUri;
                return aws.Repository.pushImage(repo, imageName)
            })
            .then(result => {
                repoInfo.imageDigest = result.digest;
                this._logger.info('_deployImage %s completed. digest= %s', imageName, result.digest);
                return repoInfo;
            });
    }

    _registerRepoInfo(service, region, deployments, repoInfo)
    {
        var repoDict = this._getClusterRegionData(service.clusterName, region);
        for(var deployment of deployments)
        {
            var deploymentData = repoDict[deployment];
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
