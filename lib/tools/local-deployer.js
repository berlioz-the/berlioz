const _ = require('the-lodash');
const Promise = require('the-promise');
const awscred = require('awscred');

const LocalProcessor = require('./local');
const Loader = require('../berlioz-common/loader');

const TableImplementation = require("./table-implementation");
const PeersFetcher = require("../berlioz-common/processing/peers-fetcher");
const TableFetcher = require("../berlioz-common/processing/table-fetcher");
const EndpointsProcessor = require("../berlioz-common/processing/endpoint-processor");

class LocalDeployer
{
    constructor(logger, configRegistry, docker, screen, shell)
    {
        this._iterationNumber = 0;
        this._logger = logger;
        this._docker = docker;
        this._screen = screen;
        this._shell = shell;
        this._configRegistry = configRegistry;
        this._repoStore = configRegistry.repoStore;
        this._repoStore.setupRepository('local-config').description('LOCAL DEPLOYMENT CONFIGURATION');
        this._repoStore.setupRepository('local-dirty-clusters').description('DIRTY LOCAL DEPLOYMENT CLUSTERS');
        this._repoStore.setupRepository('local-deployed-clusters').description('DEPLOYED CLUSTERS');

        this._repoStore.setupRepository('local_endpoints_public').description('LOCAL PUBLIC ENDPOINTS');
        this._repoStore.setupRepository('local_endpoints_internal').description('LOCAL INTERNAL ENDPOINTS');
        this._repoStore.setupRepository('local_priority_endpoints_public').description('LOCAL PRIORITY PUBLIC ENDPOINTS');
        this._repoStore.setupRepository('local_priority_endpoints_internal').description('LOCAL PRIORITY INTERNAL ENDPOINTS');
        this._repoStore.setupRepository('local_final_endpoints_public').description('LOCAL FINAL PUBLIC ENDPOINTS');
        this._repoStore.setupRepository('local_final_endpoints_internal').description('LOCAL FINAL INTERNAL ENDPOINTS');
        this._repoStore.setupRepository('local_cluster_dependencies').description('LOCAL CLUSTER DEPENDENCIES');
        this._repoStore.setupRepository('local_consumer_meta').description('LOCAL CONSUMER META');
        this._repoStore.setupRepository('local_provider_meta').description('LOCAL PROVIDER META');

        this._tableImpl = new TableImplementation(
            logger.sublogger("TableEndpointsImpl"), 
            this._repoStore
            );
    }

    get repoStore() {
        return this._repoStore;
    }

    makeQuick(value) {
        this._isQuick = value;
    }

    _createPeersFetcher()
    {
        var peersFetcher = new PeersFetcher(
            this._logger.sublogger("PeersFetcher"),
            this._tableImpl);
        return peersFetcher;
    }

    outputClusterEndpoints(clusterName)
    {
        var peersFetcher = this._createPeersFetcher();
        var clusterEntity;
        return this._loadClusterEntity(clusterName)
            .then(x => {
                clusterEntity = x;
            })
            .then(() => peersFetcher.prefetchClusterPublicEndpoints(clusterEntity))
            .then(() => {
                return Promise.serial(_.values(clusterEntity.provides), x => this._outputClusterProvided(peersFetcher, x))
            });
    }

    _outputClusterProvided(peersFetcher, clusterProvided)
    {
        this._screen.header('Cluster %s, Endpoint: %s', clusterProvided.cluster.name, clusterProvided.name);

        var endpointMap = peersFetcher.getClusterPublicEndpoints(clusterProvided);
        this._screen.outputEndpoints(endpointMap);
    }

    setup()
    {
        this._logger.info('[setup]...')
        return Promise.resolve()
            .then(() => this._fetchCredentials())
            ;
    }

    setupScale(clusterName, service, value)
    {
        return Promise.resolve()
            .then(() => this.setup())
            .then(() => this._repoStore.set('local-config', [clusterName, service], value))
            .then(() => this._markClusterDirty(clusterName))
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
            .then(() => Promise.serial(clusterNames, x => this._markDeployedCluster(x)))
            .then(() => this._processDirtyClusters());
    }

    _markDeployedCluster(clusterName)
    {
        return Promise.resolve()
            .then(() => this._repoStore.set('local-deployed-clusters', [clusterName], true))
            .then(() => this._markClusterDirty(clusterName))
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
        return Promise.serial(clusterNames, x => this._processDirtyCluster(x))
            .then(() => {
                if (clusterNames.length > 0) {
                    return this._processDirtyClusters();
                }
            })
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

    _loadClusterRegistry(clusterName)
    {
        var clusterDefinitions = this._repoStore.get('clusters', [clusterName]);
        if (clusterDefinitions == null) {
            return null;
        }
        var policyTarget = {
            deployment: 'local',
            cluster: clusterName
        }
        return Promise.resolve(this._parseDefinitions(clusterDefinitions))
            .then(registry => {
                return registry.produceDeploymentRegistry(this._logger, policyTarget, clusterName)
            });
    }

    _loadClusterEntity(clusterName)
    {
        return Promise.resolve(this._loadClusterRegistry(clusterName))
            .then(registry => {
                if (!registry) {
                    return null;
                }
                var clusterEntity = registry.getCluster(clusterName);
                return clusterEntity;
            })
    }

    _processCluster(clusterName, action)
    {
        this._screen.info('Processing cluster %s %s...', clusterName, action);
        this._logger.info('[_processCluster] BEGIN %s...', clusterName);
        var stage = 'single-stage-' + action;
        return Promise.resolve()
            .then(() => {
                if (stage == 'single-stage-deploy') {
                    return this._loadClusterRegistry(clusterName);
                } else {
                    return this._parseDefinitions([{ kind: 'cluster', name: clusterName}]);
                }
            })
            .then(registry => {
                if (!registry) {
                    this._screen.info('Cluster %s is not present.', clusterName);
                    return
                }

                var clusterEntity = registry.getCluster(clusterName);

                var clusterRepositories = this._repoStore.get('repository', [clusterEntity.name]);

                var scope = {
                    cluster: clusterName
                }
                var endpointProcessor = new EndpointsProcessor(
                    this._logger.sublogger("EndpointsProcessor"),
                    this._tableImpl,
                    scope,
                    this._handleEndpointChange.bind(this)
                    );
                endpointProcessor.namingPrefix(scope.cluster);

                this._dirtyEndpointServices = {};

                var processor = new LocalProcessor(this._logger.sublogger('LocalProc'), this._repoStore, this._docker, this._screen, this._shell);
                processor._iterationNumber = this._iterationNumber;
                processor.tableImplementation(this._tableImpl);
                processor.endpointProcessor(endpointProcessor);
                processor.peersFetcher(this._createPeersFetcher());
                processor.makeQuick(this._isQuick);
                processor.awsCredentials(this._awsCredentials);
                processor.cluster(clusterEntity);
                processor.repositories(clusterRepositories);
                return processor.perform(stage)
                    .then(() => {
                        this._screen.info('Cluster %s %sed successfully.', clusterName, action);
                    })
            })
            .then(() => {
                this._logger.info('[_processCluster] END %s...', clusterName);
            })
            .catch(error => {
                console.log(error)
                this._logger.error('Reason: ', error);
                this._logger.exception(error);

                this._screen.error('Failed to %s cluster %s', action, clusterName);
                this._screen.error(error);
            })
            .then(() => {
                this._iterationNumber = this._iterationNumber + 1;

                var clusterDependentFetcher = new TableFetcher(
                    this._logger.sublogger("TableFetcher"), 
                    "cluster_dependencies", 
                    this._tableImpl);
                    
                return Promise.serial(_.keys(this._dirtyEndpointServices), x => this._processDirtyEndpointService(clusterDependentFetcher, x));
            })
            ;
    }

    _parseDefinitions(definitions)
    {
        if (!definitions) {
            return null;
        }
        var loader = new Loader(this._logger)
        return Promise.resolve()
            .then(() => loader.fromDefinitions(definitions))
            .then(registry => {
                return registry;
            });
    }

    _markClusterDirty(clusterName)
    {
        this._logger.info('[_markClusterDirty] %s...', clusterName);
        this._repoStore.set('local-dirty-clusters', [clusterName], true);
    }

    _clearClusterDirty(clusterName)
    {
        this._logger.info('[_clearClusterDirty] %s...', clusterName);
        this._repoStore.delete('local-dirty-clusters', [clusterName]);
    }

    _handleEndpointChange(name, deltaRow)
    {
        this._logger.info("[_handleEndpointChange] %s : ", name, deltaRow);
        this._dirtyEndpointServices[deltaRow.row.service] = true;
    }

    _processDirtyEndpointService(clusterDependentFetcher, serviceId)
    {
        this._logger.info("[_processDirtyEndpointService] %s ", serviceId);

        return clusterDependentFetcher.query({ dependent: serviceId })
            .then(results => {
                var entries = _.values(results);
                var clusterNames = _.map(entries, x => x.cluster);
                clusterNames = _.uniq(clusterNames);
                // this._logger.info("[_processDirtyEndpointService] %s dependent clusters: ", name, clusterNames);
                for(var cluster of clusterNames) {
                    this._markClusterDirty(cluster);
                }
            })

    }

}

module.exports = LocalDeployer;
