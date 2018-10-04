const _ = require('the-lodash');
const Promise = require('the-promise');
const awscred = require('awscred');

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
        this._repoStore.setupRepository('local-config', 'LOCAL DEPLOYMENT CONFIGURATION');
        this._repoStore.setupRepository('local-dirty-clusters', 'DIRTY LOCAL DEPLOYMENT CLUSTERS');
        this._repoStore.setupRepository('local-deployed-clusters', 'DEPLOYED CLUSTERS');
        this._repoStore.setupRepository('local-endpoints-external', 'EXTERNAL CLUSTER ENDPOINTS');
        this._repoStore.setupRepository('local-endpoints-public', 'PUBLIC CLUSTER ENDPOINTS');
    }

    get repoStore() {
        return this._repoStore;
    }

    makeQuick(value) {
        this._isQuick = value;
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
            if (this._repoStore.get('clusters', [clusterNameOrNone]))
            {
                clusterNames = [clusterNameOrNone];
            }
            else
            {
                screen.error('Cluster %s not present.', clusterNameOrNone);
                return Promise.resolve();
            }
        }
        else
        {
            clusterNames = _.keys(this._repoStore.get('clusters', []));
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
        var region = this._configRegistry.get('config', 'local-aws-region');
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
                        region: region,
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
        var policyTarget = {
            deployment: 'local',
            cluster: clusterName
        }
        return Promise.resolve()
            .then(() => {
                if (stage == 'single-stage-deploy') {
                    var clusterDefinitions = this._repoStore.get('clusters', [clusterName]);
                    return Promise.resolve(this._parseDefinitions(clusterDefinitions))
                        .then(registry => {
                            return registry.produceDeploymentRegistry(this._logger, policyTarget, clusterName)
                        });
                } else {
                    return Promise.resolve(this._parseDefinitions([{ kind: 'cluster', name: clusterName}]))
                }
            })
            .then(registry => {
                if (!registry) {
                    this._screen.info('Cluster %s is not present.', clusterName);
                    return
                }

                var clusterEntity = registry.getCluster(clusterName);

                var clusterRepositories = this._repoStore.get('repository', [clusterEntity.name]);

                var processor = new LocalProcessor(this._logger.sublogger('LocalProc'), this._repoStore, this._docker, this._screen, this._shell);
                processor.makeQuick(this._isQuick);
                processor.awsCredentials(this._awsCredentials);
                processor.cluster(clusterEntity);
                processor.repositories(clusterRepositories);
                return processor.perform(stage)
                    .then(() => {
                        this._screen.info('Cluster %s %sed successfully.', clusterName, action);
                    })
            })
            .catch(error => {
                console.log(error)
                this._logger.error('Reason: ', error);
                this._logger.exception(error);

                this._screen.error('Failed to %s cluster %s', action, clusterName);
                this._screen.error(error);
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
