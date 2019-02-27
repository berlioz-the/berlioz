const fs = require('fs');
const _ = require('the-lodash');
const Promise = require('the-promise');
const execa = require('execa');

class PublisherGcp
{
    constructor(logger, screen, parent)
    {
        this._logger = logger;
        this._screen = screen;
        this._parent = parent;
        this._registry = this._parent._registry;
        this._config =  this._parent._config;
        this._isDockerReady = null;
    }

    get logger() {
        return this._logger;
    }

    get screen() {
        return this._screen;
    }

    execute(provider)
    {          
        var clusters = this._parent._getClusters();
        return Promise.serial(clusters, x => this._deployCluster(provider, x));
    }

    _deployCluster(provider, cluster)
    {
        this.logger.info("[_deployCluster] %s...", cluster.name)
        return Promise.resolve()
            .then(() => {
                var services = cluster.services;
                if (this._parent._targetService) {
                    services = services.filter(x => x.name == this._parent._targetService);
                }
                if (services.length == 0) {
                    return;
                }
                return Promise.resolve()
                    .then(() => this._prepareDocker(provider))
                    .then(() => Promise.serial(services, x => this._deployService(provider, x)))
                    ;
            })
            ;
    }

    _deployService(provider, service)
    {
        var imageInfo = this._config.get('repository', [service.naming[0], service.id])
        if (!imageInfo) {
            throw new Error('Image for ' + service.id + ' is not built.');
        }
        var remoteImage = this._getRemoteImageName(provider, service);
        return Promise.resolve()
            .then(() => this._runDocker(['tag', imageInfo.name, remoteImage]))
            .then(() => this._deployImage(remoteImage))
            .then(repoInfo => {
                var regionDeploymentMap = this._parent._decidedDeployments[provider.name];

                for(var region of _.keys(regionDeploymentMap)) {
                    var repoDict = this._parent._getClusterRegionData(service.clusterName, region);
                    var deployments = regionDeploymentMap[region];
                    for(var deployment of deployments)
                    {
                        if (!(deployment in repoDict)) {
                            repoDict[deployment] = {};
                        }
                    }
                    var deployments = regionDeploymentMap[region];
                    this._parent._registerServiceInfo(service, region, deployments, repoInfo);
                }
            })
            ;
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

    _getRemoteImageName(provider, service)
    {
        var imageInfo = this._config.get('repository', [service.naming[0], service.id])
        if (!imageInfo) {
            throw new Error('Image for ' + service.id + ' is not built.');
        }
        return 'gcr.io/' + provider.credentials.project_id + '/' + imageInfo.name;
    }

    _prepareDocker(provider)
    {
        if (this._isDockerReady) {
            return;
        }

        return this._loginToProvider(provider)
            .then(() => {
                this._isDockerReady = true;
            })
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
