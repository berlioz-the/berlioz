const fs = require('fs');
const _ = require('the-lodash');
const Promise = require('the-promise');
const AWSClient = require('aws-sdk-wrapper');
const ArnParser = require('aws-arn-parser');

class PublisherAws
{
    constructor(logger, screen, parent)
    {
        this._logger = logger;
        this._screen = screen;
        this._parent = parent;
        this._registry = this._parent._registry;
        this._config =  this._parent._config;
        this._accountId = null;
        this._clusterBuckets = {};
    }

    executeLegacy(provider, regions)
    {
        var regionDeploymentMap = this._parent._decidedDeployments[provider.name];
        return Promise.serial(regions, x => this._deployToRegion(provider, x, regionDeploymentMap[x]));
    }

    _deployToRegion(provider, region, deployments)
    {
        this._logger.info('DEPLOYMENT to %s :: %s. Deployments: ... ', provider.name, region, deployments);
        this._screen.info('PROVIDER: ', provider);

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
                var clusters = this._parent._getClusters();
                return Promise.serial(clusters, x => this._deployClusterToRegion(x, aws, region, deployments));
            });
    }

    _deployClusterToRegion(cluster, aws, region, deployments)
    {
        this._logger.info('_deployClusterToRegion :: %s => %s...', cluster.name, region);

        var repoDict = this._parent._getClusterRegionData(cluster.name, region);
        for(var deployment of deployments)
        {
            if (!(deployment in repoDict)) {
                repoDict[deployment] = {};
            }
        }

        return Promise.resolve()
            .then(() => {
                var services = cluster.services;
                if (this._parent._targetService) {
                    services = services.filter(x => x.name == this._parent._targetService);
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
                if (lambdas.length == 0) {
                    return;
                }
                return this._getClusterBucket(aws, cluster.name, aws.region)
                    .then(() => Promise.parallel(lambdas, x => this._deployLambdaToRegion(cluster, x, aws, deployments)));
            })
            ;
    }

    _getClusterBucket(aws, clusterName, region)
    {
        if (clusterName in this._clusterBuckets) {
            if (region in this._clusterBuckets[clusterName]) {
                return Promise.resolve(this._clusterBuckets[clusterName][region]);
            }
        }

        return Promise.resolve()
            .then(() => aws.S3.createBucket(this._accountId + '-berlioz-image-store-' + clusterName + '-' + region))
            .then(berliozBucketInfo => {
                if (!(clusterName in this._clusterBuckets)) {
                    this._clusterBuckets[clusterName] = {};
                }
                this._clusterBuckets[clusterName][region] = berliozBucketInfo;
                return berliozBucketInfo;
            })
    }

    _deployServiceToRegion(cluster, service, aws, region, deployments)
    {
        if (!service.isManaged) {
            return;
        }
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
            .then(repoInfo => this._parent._registerServiceInfo(service, region, deployments, repoInfo))
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

    _deployLambdaToRegion(cluster, lambda, aws, deployments)
    {
        this._logger.info('[_deployLambdaToRegion] %s... ', lambda.id);
        this._screen.info('Preparing %s to %s...', lambda.id, aws.region)

        var lambdaInfo = this._config.get('repository', [lambda.naming[0], lambda.id])
        if (!lambdaInfo) {
            throw new Error('Code for ' + lambda.id + ' is not built.');
        }
        this._logger.info('[_deployLambdaToRegion] %s, info:', lambda.id, lambdaInfo);

        var pathNaming = _.clone(lambda.naming);
        pathNaming.push(lambdaInfo.digest);
        var keyPath = pathNaming.join('/');
        var berliozBucketInfo = null;
        return this._getClusterBucket(aws, cluster.name, aws.region)
            .then(result => {
                berliozBucketInfo = result;
                return aws.S3.getObjectMetadata(berliozBucketInfo.Bucket, keyPath)
            })
            .then(result => {
                if (result) {
                    return;
                }
                if (!fs.existsSync(lambdaInfo.path)) {
                    this._screen.error('Failed to upload %s from %s. Destination does not exist.', lambda.id, lambdaInfo.path);
                    throw new Error('Path ' + lambdaInfo.path +  ' for lambda ' + lambda.id + ' does not exist.');
                }
                var stream = fs.createReadStream(lambdaInfo.path)
                this._screen.info('Uploading %s to %s...', lambda.id, aws.region)
                return aws.S3.upload(berliozBucketInfo.Bucket, keyPath, stream);
            })
            .then(() => {
                this._screen.info('Upload of %s to %s completed.', lambda.id, aws.region)
                var remoteLambdaInfo = {
                    bucket: berliozBucketInfo.Bucket,
                    key: keyPath,
                    region: aws.region
                }
                return this._parent._registerLambdaInfo(lambda, aws.region, deployments, remoteLambdaInfo)
            })
    }




}

module.exports = PublisherAws;
