const fs = require('fs');
const Path = require('path');
const _ = require('the-lodash');
const Promise = require('the-promise');
const GcpSdkClient = require('berlioz-gcp-sdk');
const BerliozCommon = require('../berlioz-common');

class PublisherGcp
{
    constructor(logger, screen, parent)
    {
        this._logger = logger;
        this._screen = screen;
        this._parent = parent;
        this._registry = this._parent._registry;
        this._config =  this._parent._config;
    }

    get logger() {
        return this._logger;
    }

    get screen() {
        return this._screen;
    }

    get shell() {
        return this._parent.shell;
    }

    fetchRegionClient(provider, region)
    {
        this.logger.info("[fetchRegionClient] %s :: ", region, provider);
        return new GcpSdkClient(this._logger.sublogger('GCPClient'), region, provider.credentials);
    }

    prepareDeployServices(provider, cluster, regions, regionClients)
    {
        return this._loginToProvider(provider)
            .then(() => Promise.serial(regions, x => this._prepareServiceDeployer(regionClients[x])))
    }

    _prepareServiceDeployer(gcpClient)
    {
        var criticalServiceAPIs = [
            'cloudresourcemanager.googleapis.com', 
            'containerregistry.googleapis.com',
            'container.googleapis.com'
        ];
        return this._setupNativeProcessor(gcpClient, criticalServiceAPIs);
    }

    _setupNativeProcessor(gcpClient, criticalServiceAPIs)
    {
        this.logger.info("[_prepareServiceDeployer] region: %s... ", gcpClient.region);
        var nativeProcessor = BerliozCommon.newNativeProcessor(this._logger, this);
        var nativeProcessorScope = {
            metaContext: {},
            providerKind: 'gcp',
            gcpAccountId: gcpClient.projectId,
            sourceRegion: gcpClient.sourceRegion,
            region: gcpClient.region,
            shortRegion: _.replaceAll(gcpClient.region, '-', ''),
            zone: gcpClient.zone,
            projectId: gcpClient.projectId,
            gcp: gcpClient,
            gcpCriticalServiceAPIs: criticalServiceAPIs
        }
        return Promise.resolve()
            .then(() => nativeProcessor.setupScope(nativeProcessorScope))
            .then(() => nativeProcessor.init())
    }

    deployService(provider, service, imageInfo)
    {
        this.logger.info("[deployService] %s... ", service.id, imageInfo);
        var remoteImage = 'gcr.io/' + provider.credentials.project_id + '/' + imageInfo.name;
        return Promise.resolve()
            .then(() => this.shell.runDocker(['tag', imageInfo.name, remoteImage]))
            .then(() => this._deployImage(remoteImage))
            ;   
    }

    _fixFileName(str)
    {
        str = _.replaceAll(str, ':', '-');
        str = _.replaceAll(str, '/', '');
        return str;
    }

    deployLambdaToRegion(provider, lambda, imageInfo, region, client)
    {
        this.logger.info("[deployLambdaToRegion] %s to %s... ", lambda.id, region, imageInfo);

        var remotePathParts = [
            lambda.clusterName,
            this._fixFileName(lambda.id),
            imageInfo.digest
        ];
        
        var remotePath = remotePathParts.join('/');
        var bucketName = null;
        return Promise.resolve()
            .then(() => this._getImageBucket(lambda, region, client))
            .then(result => {
                bucketName = result;
                return client.Storage.fileExists(bucketName, remotePath);
            }) 
            .then(exists => {
                if (exists) {
                    this._screen.info('Skipping %s.', lambda.id)
                    return;
                }
                var options = {

                }
                this._screen.info('Uploading %s...', lambda.id)
                return client.Storage.uploadLocalFile(bucketName, remotePath, imageInfo.path, options);
            })
            .then(() => {
                return {
                    bucket: bucketName,
                    key: remotePath
                }
            })
    }

    deployDatabaseToRegion(provider, database, imageInfo, region, client)
    {
        this.logger.info("[deployDatabaseToRegion] %s to %s... ", database.id, region, imageInfo);

        var remotePathParts = [
            database.clusterName,
            this._fixFileName(database.id),
            imageInfo.digest
        ];
        
        var remotePath = remotePathParts.join('/');
        var bucketName = null;
        return Promise.resolve()
            .then(() => this._getImageBucket(database, region, client))
            .then(result => {
                bucketName = result;
                var files = fs.readdirSync(imageInfo.path);
                return Promise.serial(files, x => {
                    var localFilePath = Path.join(imageInfo.path, x);
                    var remoteFilePath = [remotePath, x].join('/');
                    return client.Storage.fileExists(bucketName, remoteFilePath)
                        .then(exists => {
                            if (exists) {
                                this._screen.info('Skipping %s', localFilePath)
                                return;
                            }
                            var options = {

                            }
                            this._screen.info('Uploading %s...', localFilePath)
                            return client.Storage.uploadLocalFile(bucketName, remoteFilePath, localFilePath, options);
                        })
                })
            }) 
            .then(() => {
                return {
                    bucket: bucketName,
                    key: remotePath
                }
            })
    }

    _getImageBucket(entity, region, client)
    {
        var bucketName = null;
        this.logger.info('[_getImageBucket] bucket name: %s', bucketName);
        return Promise.resolve()
            .then(() => client.getProjectNumber())
            .then(projectNumber => {
                bucketName = `${projectNumber}-artifacts-berlioz-cloud`
                this.logger.info('[_getImageBucket] bucket name: %s', bucketName);
            })
            .then(() => client.Storage.queryBucket(bucketName))
            .then(result => {
                if (result) {
                    return result;
                } 
                var options = {
                    "storageClass": "multi_regional",
                    "labels": {
                    }
                }
                return client.Storage.createBucket(bucketName, options);
            })
            .then(result => {
                this.logger.info('[_getImageBucket] bucket: ', result);
                return result.id;
            });
    }

    _deployImage(remoteImage)
    {
        var repoInfo = {
            image: remoteImage
        };
        return Promise.resolve()
            .then(() => this.shell.runDocker(['push', remoteImage]))
            .then(result => {
                repoInfo.digest = this._extractDigestFromStream(result.stdout);
                this._logger.info('_deployImage %s completed. digest=%s', remoteImage, repoInfo.digest);
                return repoInfo;
            })
            ;
    }

    _extractDigestFromStream(out)
    {
        var re = /(sha256:\S+)/g;
        var found = out.match(re);
        if (found.length != 1) {
            throw new Error('Cound not fetch the digest for repository: %s', name);
        }
        return found[0];
    }

    _loginToProvider(provider)
    {
        var keyContent = JSON.stringify(provider.credentials, null, 4);
        return Promise.resolve()
            .then(() => this._parent._storage.writeToTmpConfigFile('gcp-key.json', keyContent))
            .then(filePath => {
                return this.shell.runGCloud(['auth', 'activate-service-account', '--key-file', filePath]);
            })
            .then(() => {
                return this.shell.runGCloud(['auth', 'configure-docker', '--quiet']);
            })
            ;
    }
}

module.exports = PublisherGcp;
