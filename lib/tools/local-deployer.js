const os = require('os');
const path = require('path');
const _ = require('the-lodash');
const Promise = require('the-promise');
const awscred = require('awscred');

const Cluster = require('../berlioz-common/entities/cluster');
const LocalProcessor = require('./local');
const Loader = require('../berlioz-common/loader');

class LocalDeployer
{
    constructor(logger, configRegistry, docker, screen, shell)
    {
        this._logger = logger;
        this._docker = docker;
        this._screen = screen;
        this._shell = shell;
        this._configRegistry = configRegistry;
        this._repoStore = configRegistry.repoStore;
        this._repoStore.setupRepository('local-clusters', 'LOCAL REPOSITORIES');
        this._repoStore.setupRepository('local-config', 'LOCAL DEPLOYMENT CONFIGURATION');
        this._repoStore.setupRepository('local-dirty-clusters', 'DIRTY LOCAL DEPLOYMENT CLUSTERS');
        this._repoStore.setupRepository('local-deployed-clusters', 'DEPLOYED CLUSTERS');
        this._repoStore.setupRepository('local-endpoints-external', 'EXTERNAL CLUSTER ENDPOINTS');
        this._repoStore.setupRepository('local-endpoints-public', 'PUBLIC CLUSTER ENDPOINTS');
    }

    get repoStore() {
        return this._repoStore;
    }

    outputClusterEndpoints(cluster)
    {
        var clusterEndpointMap = this.repoStore.get('local-endpoints-public', [cluster]);
        if (clusterEndpointMap)
        {
            for(var endpointName of _.keys(clusterEndpointMap))
            {
                this.outputEndpoints(cluster, endpointName, clusterEndpointMap[endpointName])
            }
        }
    }

    outputEndpoints(cluster, endpoint, entryMap)
    {
        this._screen.header('Cluster %s, Endpoint: %s', cluster, endpoint);
        this._screen.outputEndpoints(entryMap);
    }

    pushImages(registry)
    {
        return Promise.serial(registry.clusters(), x => this._pushClusterImages(x));
    }

    _pushClusterImages(cluster)
    {
        var clusterData = {
            definitions: cluster.extractDefinitions(),
            repositories: {}
        };
        return Promise.serial(cluster.services, x => this._pushServiceImages(clusterData.repositories, x))
            .then(() => {
                this._repoStore.set('local-clusters', [cluster.name], clusterData);
            })
            ;
    }

    _pushServiceImages(clusterRepos, service)
    {
        var imageName = service.clusterName + '-' + service.name;
        // this._logger('_pushServiceImages: %s...', imageName);
        return this._docker.getImage(imageName)
            .then(result => {
                if (!result) {
                    throw new Error('Service image not built: ' + imageName);
                }
                // this._logger.info(result);
                clusterRepos[service.clusterName + '/' + service.name] = {
                    image: imageName,
                    digest: result.Id
                }
             })
             .catch(reason => {
                 this._logger.error('Failed to push %s image...', service.id);
             })
             ;
    }

    setup()
    {
        this._logger.info('[setup]...')
        return Promise.resolve()
            .then(() => this._fetchCredentials())
            ;
    }

    setupScale(cluster, service, value)
    {
        return Promise.resolve()
            .then(() => this.setup())
            .then(() => this._repoStore.set('local-config', [cluster, service], value))
            .then(() => this._markClusterDirty(cluster))
            .then(() => this._processDirtyClusters())
            ;
    }

    deployClusters(clusterNameOrNone, screen)
    {
        var clusterNames = [];
        if (clusterNameOrNone)
        {
            if (this._repoStore.get('local-clusters', [clusterNameOrNone]))
            {
                clusterNames = [clusterNameOrNone];
            }
            else
            {
                screen.error('Cluster %s not present.', clusterNameOrNone);
                return;
            }
        }
        else
        {
            clusterNames = _.keys(this._repoStore.get('local-clusters', []));
        }

        return Promise.resolve()
            .then(() => this.setup())
            .then(() => Promise.serial(clusterNames, x => this._deployCluster(x)))
            .then(() => this._processDirtyClusters());
    }

    _deployCluster(clusterName)
    {
        return Promise.resolve()
            .then(() => this._repoStore.set('local-deployed-clusters', [clusterName], true))
            .then(() => this._markClusterDirty(clusterName))
            .then(() => this._processDirtyClusters())
            ;
    }

    undeployCluster(clusterName)
    {
        return Promise.resolve()
            .then(() => this._repoStore.delete('local-deployed-clusters', [clusterName]))
            .then(() => this._markClusterDirty(clusterName))
            .then(() => this._processDirtyClusters())
            ;
    }

    _processDirtyClusters()
    {
        var clusterNames = _.keys(this._repoStore.get('local-dirty-clusters', []));
        return Promise.serial(clusterNames, x => this._processDirtyCluster(x));
    }

    _processDirtyCluster(clusterName)
    {
        this._logger.info('[_processDirtyCluster] %s...', clusterName);
        this._clearClusterDirty(clusterName);
        var isDeployed = this._repoStore.get('local-deployed-clusters', [clusterName]);
        if (isDeployed)
        {
            return this._processCluster(clusterName, 'deploy');
        }
        else
        {
            return this._processCluster(clusterName, 'undeploy');
        }
    }

    _fetchCredentials()
    {
        var profile = this._configRegistry.get('config', 'local-aws-profile');
        this._logger.info('[_fetchCredentials] profile: %s...', profile);
        this._awsCredentials = null;
        if (!profile) {
            return;
        }
        return new Promise((resolve, reject) => {
            var options = {
                profile: profile
            }
            awscred.loadCredentialsFromIniFile(options, (err, data) => {
                if (err) throw err
                this._logger.info('[_fetchCredentials] credentials: ', data);
                if (data.accessKeyId && data.secretAccessKey) {
                    this._awsCredentials = {
                        profile: profile,
                        key: data.accessKeyId,
                        secret: data.secretAccessKey
                    };
                }
                resolve();
            })
        });
    }

    _processCluster(clusterName, action)
    {
        this._screen.info('Processing cluster %s %s...', clusterName, action);
        var stage = 'single-stage-' + action;
        var repositories = null;
        return Promise.resolve()
            .then(() => {
                if (stage == 'single-stage-deploy') {
                    var clusterData = this._repoStore.get('local-clusters', [clusterName]);
                    repositories = clusterData.repositories;
                    return Promise.resolve(this._parseDefinitions(clusterData.definitions))
                        .then(registry => {
                            var clusterEntity = null;
                            if (registry) {
                                clusterEntity = registry.getCluster(clusterName);
                            }
                            if (!clusterEntity) {
                                this._logger.info('Cluster %s is not present.', clusterName);
                                return;
                            }
                            return clusterEntity;
                        });
                } else {
                    var clusterEntity = new Cluster({ kind: 'cluster', name: clusterName});
                    return clusterEntity;
                }
            })
            .then(clusterEntity => {
                var processor = new LocalProcessor(this._logger.sublogger('LocalProc'), this._repoStore, this._docker, this._screen, this._shell);
                processor.awsCredentials(this._awsCredentials);
                processor.cluster(clusterEntity);
                processor.repositories(repositories);
                return processor.perform(stage);
            })
            .then(() => {
                this._screen.info('Cluster %s %sed successfully.', clusterName, action);
            })
            .catch(error => {
                this._logger.error('Reason: ', error);

                this._screen.error('Failed to %s cluster %s', action, clusterName);
                this._screen.error('Reason: %s', error);
            })
            ;
    }

    _parseDefinitions(definitions)
    {
        if (!definitions) {
            return null;
        }
        var loader = new Loader(this._logger)
        var registry = null;
        return Promise.resolve()
            .then(() => loader.fromDefinitions(definitions))
            .then(registry => {
                return registry;
            });
    }

    _markClusterDirty(cluster)
    {
        this._repoStore.set('local-dirty-clusters', [cluster], true);
    }

    _clearClusterDirty(cluster)
    {
        this._repoStore.delete('local-dirty-clusters', [cluster]);
    }

}

module.exports = LocalDeployer;
