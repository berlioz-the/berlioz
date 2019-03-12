const fs = require('fs');
const _ = require('the-lodash');
const Promise = require('the-promise');
const execa = require('execa');
const GcpSdkClient = require('berlioz-gcp-sdk');

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

    fetchRegionClient(provider, region)
    {
        this.logger.info("[fetchRegionClient] %s :: ", region, provider);
        return new GcpSdkClient(this._logger.sublogger('GCPClient'), region, provider.credentials);
    }

    prepareDeployServices(provider, cluster)
    {
        return this._loginToProvider(provider)
    }

    deployService(provider, service, imageInfo)
    {
        this.logger.info("[deployService] %s... ", service.id, imageInfo);
        var remoteImage = 'gcr.io/' + provider.credentials.project_id + '/' + imageInfo.name;
        return Promise.resolve()
            .then(() => this._runDocker(['tag', imageInfo.name, remoteImage]))
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

    _getImageBucket(entity, region, client)
    {
        var bucketName = `${client.projectId}-imagestore-${entity.naming[0]}`;
        this.logger.info('[_getImageBucket] bucket name: %s', bucketName);
        return client.Storage.queryBucket(bucketName)
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
            .then(() => this._runDocker(['push', remoteImage]))
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
                return this._runGCloud(['auth', 'activate-service-account', '--key-file', filePath]);
            })
            .then(() => {
                return this._runGCloud(['auth', 'configure-docker', '--quiet']);
            })
            ;
    }

    _runGCloud(args)
    {
        return this._runCommandInShell('gcloud', args);    
    }

    _runDocker(args)
    {
        return this._runCommandInShell('docker', args);
    }

    _runCommandInShell(name, args)
    {
        this.screen.info('$ %s %s', name, args.join(' '));
        this.logger.info('RUNNING SHELL: %s :: ', name, args);

        var spawned = execa(name, args, {
            // cwd: appPath,
            env: Object.assign({}, process.env, {
              PYTHONUNBUFFERED: true
            })
        });
        spawned.stdout.on('data', (data) => {
            for(var x of data.toString().split('\n')) {
                this.screen.info(`|  ${x}`);
            }
        });
        spawned.stderr.on('data', (data) => {
            for(var x of data.toString().split('\n')) {
                this.screen.info(`|  ${x}`);
            }
        });
        return spawned
          .then(result => {
              this.logger.info("COMMAND RESULT: ", result);
              this.screen.info('|  CODE: %s.', result.code);
              return result;
          })
          .catch(reason => {
              this.logger.warn("COMMAND FAILED: ", reason);
              this.screen.error('|  ERROR: %s.', reason.message);
              throw reason;
          })
    }

    _runCommand(name, args)
    {
        const spawn = require('child_process').spawn;
        return new Promise((resolve, reject) => {
            this.logger.info('RUNNING: ' + name + ' ' + args.join(" "));
            const proc = spawn(name, args);
            proc.stdout.on('data', (data) => {
                for(var x of data.toString().split('\n')) {
                    this.screen.info(`|  ${x}`);
                }
            });
            proc.stderr.on('data', (data) => {
                for(var x of data.toString().split('\n')) {
                    this.screen.info(`|  ${x}`);
                }
            });
            proc.on('close', (code) => {
                console.log(`child process exited with code ${code}`);
                if (code == 0) {
                    resolve();
                } else {
                    reject(code);
                }
            });
        });
    }

}

module.exports = PublisherGcp;
