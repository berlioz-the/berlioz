const fs = require('fs');
const _ = require('the-lodash');
const Promise = require('the-promise');
const AWSClient = require('aws-sdk-wrapper');

class Publisher
{
    constructor(logger, registry, config, client)
    {
        this._logger = logger;
        this._registry = registry;
        this._config = config;
        this._client = client;
        this._clusterData = {};
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
        return Promise.resolve()
            .then(() => this._queryDeployments())
            .then(() => this._queryProviders())
            .then(() => this._decideDeployments())
            .then(() => this._processClusters())
            .then(() => this._processDeployments())
            .then(() => this._publishClusterData())
            ;
    }

    _queryDeployments()
    {
        return this._client.get('/deployment')
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
        return this._client.get('/provider')
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
            for(var region of deployment.regions)
            {
                if (!(deployment.provider in this._decidedDeployments))
                {
                    this._decidedDeployments[deployment.provider] = {};
                }
                if (!(region in this._decidedDeployments[deployment.provider]))
                {
                    this._decidedDeployments[deployment.provider][region] = [];
                }
                this._decidedDeployments[deployment.provider][region].push(deployment.name);
            }
        }
        this._logger.info('DECIDED DEPLOYMENTS: ', this._decidedDeployments);
    }

    _processClusters()
    {
        var clusters = this._registry.clusters();
        if (this._targetCluster) {
            clusters = clusters.filter(x => x.name == this._targetCluster);
        }

        for(var cluster of clusters)
        {
            var clusterInfo = {
                name: cluster.name,
                cluster: cluster,
                definition: cluster.extractDefinitions(),
                repositories: {}
            };

            this._clusterData[cluster.name] = clusterInfo;
        }

        return Promise.serial(_.values(this._clusterData), x => this._publishClusterDefinition(x));
    }

    _processDeployments()
    {
        return Promise.serial(_.keys(this._decidedDeployments), x => this._deployToProvider(x));
    }

    _deployToProvider(providerName)
    {
        this._logger.info('[_deployToProvider] %s... ', providerName);
        var provider = this._providers[providerName];

        var regionMap = this._decidedDeployments[providerName];
        var regions = _.keys(regionMap);
        return Promise.serial(regions, x => this._deployToRegion(provider, x, regionMap[x]));
    }

    _deployToRegion(provider, region, deployments)
    {
        this._logger.info('DEPLOYMENT to %s :: %s. Deployments: ... ', provider.name, region, deployments);
        var credentialsConfig = {
                key: provider.key,
                secret: provider.secret
            };
        var aws = new AWSClient(region, credentialsConfig, this._logger.sublogger('AWSClient'));
        var clusters = _.values(this._clusterData).map(x => x.cluster);
        return Promise.serial(clusters, x => this._deployClusterToRegion(x, aws, region, deployments));
    }

    _deployClusterToRegion(cluster, aws, region, deployments)
    {
        this._logger.info('_deployClusterToRegion :: %s', cluster.name);

        var repoDict = this._clusterData[cluster.name].repositories;
        if (!(region in repoDict)) {
            repoDict[region] = {};
        }
        repoDict = repoDict[region];
        for(var deployment of deployments)
        {
            if (!(deployment in repoDict)) {
                repoDict[deployment] = {};
            }
        }

        var berliozBucketInfo = null;
        return Promise.resolve()
            .then(() => aws.S3.createBucket('berlioz-image-store-' + cluster.name + '-' + region))
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
                var images = this._registry.images();
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

        var lambdaInfo = this._config.get('repository', [lambda.naming[0], lambda.id])
        if (!lambdaInfo) {
            throw new Error('Code for ' + lambda.id + ' is not built.');
        }
        this._logger.info('[_deployLambdaToRegion] %s, info:', lambda.id, lambdaInfo);

        var pathNaming = _.clone(lambda.naming);
        pathNaming.push(lambdaInfo.digest);
        var stream = fs.createReadStream(lambdaInfo.path)
        var keyPath = pathNaming.join('/');
        return aws.S3.upload(berliozBucketInfo.Bucket, keyPath, stream)
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
        var repoDict = this._clusterData[lambda.clusterName].repositories;
        repoDict = repoDict[region];
        for(var deployment of deployments)
        {
            var deploymentData = repoDict[deployment];
            if (!deploymentData.lambdas) {
                deploymentData.lambdas = {}
            }
            deploymentData.lambdas[lambda.clusterName + '/' + lambda.name] = repoInfo;
        }
    }

    _deployServiceToRegion(cluster, service, aws, region, deployments)
    {
        this._logger.info('_deployServiceToRegion :: %s to %s', service.name, aws.region);
        var imageInfo = this._config.get('repository', [service.naming[0], service.id])
        if (!imageInfo) {
            throw new Error('Image for ' + service.id + ' is not built.');
        }
        var repoName = service.image;
        return this._deployImage(imageInfo.name, repoName, aws)
            .then(repoInfo => {
                this._registerRepoInfo(service, region, deployments, repoInfo);
            })
    }

    _deployImageToRegion(cluster, image, aws)
    {
        this._logger.info('_deployImageToRegion :: %s to %s', image.name, aws.region);
        var imageInfo = this._config.get('repository', [item.naming[0], item.id])
        if (!imageInfo) {
            throw new Error('Image for ' + image.id + ' is not built.');
        }
        var repoName = image.image;
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
        var repoDict = this._clusterData[service.clusterName].repositories;
        repoDict = repoDict[region];
        for(var deployment of deployments)
        {
            var deploymentData = repoDict[deployment];
            if (!deploymentData.services) {
                deploymentData.services = {}
            }
            deploymentData.services[service.clusterName + '/' + service.name] = repoInfo;
        }
    }

    _publishClusterDefinition(clusterInfo)
    {
        this._logger.info('[_publishClusterDefinition]. Cluster=%s, Definition:', clusterInfo.name, clusterInfo.definition);

        var data = {
            cluster: clusterInfo.name,
            definition: clusterInfo.definition
        };
        return this._client.post('/cluster-data/setup', data)
            .then(result => {
                clusterInfo.version = result.date;
            });
    }

    _publishClusterData()
    {
        // this._logger.info('PUBLISH REPO DATA', this._clusterData);

        return Promise.serial(_.values(this._clusterData), clusterInfo => {

            return Promise.serial(_.keys(clusterInfo.repositories), region => {

                return Promise.serial(_.keys(clusterInfo.repositories[region]), deployment => {

                    var repoInfo = clusterInfo.repositories[region][deployment];
                    return this._publishCluster(clusterInfo, region, deployment, repoInfo);

                });

            });

        });
    }

    _publishCluster(clusterInfo, region, deployment, repoInfo)
    {
        this._logger.info('[_publishCluster]. Cluster=%s, Deployment=%s, Region=%s, Repositories:', clusterInfo.name, deployment, region, repoInfo);

        var data = {
            cluster: clusterInfo.name,
            deployment: deployment,
            region: region,
            clusterVersion: clusterInfo.version,
            repositories: repoInfo
        };
        return this._client.post('/cluster-deployment-data/setup', data);
    }



}

module.exports = Publisher;
