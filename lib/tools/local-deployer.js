const _ = require('the-lodash');
const Promise = require('the-promise');
const awscred = require('awscred');
const DateDiff = require('date-diff');

const LocalProcessor = require('./local');

const BeriozCommon = require('../berlioz-common');
const Loader = require('../berlioz-common/loader');

const TableImplementation = require("./table-implementation");
const PeersFetcher = require("../berlioz-common/processing/peers-fetcher");
const TableFetcher = require("../berlioz-common/processing/table-fetcher");
const EndpointsProcessor = require("../berlioz-common/processing/endpoint-processor");
const MetadataProcessor = require("../berlioz-common/processing/metadata-processor");


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
        this._repoStore.setupRepository('local_deployment_metadata').description('LOCAL DEPLOYMENT META');
        
        this._tableImpl = new TableImplementation(
            logger.sublogger("TableEndpointsImpl"), 
            this._repoStore
            );

        this._providers = {};
    }

    get repoStore() {
        return this._repoStore;
    }

    get providersConfig() {
        return _.values(this._providers);
    }

    getProviderConfig(name)
    {
        var provider = this._providers[name];
        if (!provider) {
            return null;
        }
        return provider;
    }

    getProviderClient(name)
    {
        var providerConfig = this.getProviderConfig(name);
        if (!providerConfig) {
            return null;
        }
        if (name == 'aws') {
            const AWSClient = require('aws-sdk-wrapper');
            return new AWSClient(
                providerConfig.region,
                providerConfig.credentials, 
                this._logger.sublogger('AWSClient'));
        }
        if (name == 'gcp') {
            const GCPClient = require('berlioz-gcp-sdk');
            return new GCPClient(
                this._logger.sublogger('GCPClient'),
                providerConfig.region,
                providerConfig.credentials);
        }
        throw new Error(`Unsupported local provider: ${name}.`);
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
        this._logger.info("[outputClusterEndpoints] %s...", clusterName)
        return this._loadClusterEntity(clusterName)
            .then(clusterEntity => {
                if (!clusterEntity) {
                    return;
                }
                var peersFetcher = this._createPeersFetcher();
                return Promise.resolve()
                    .then(() => peersFetcher.prefetchClusterPublicEndpoints(clusterEntity))
                    .then(() => {
                        return Promise.serial(_.values(clusterEntity.provides), x => this._outputClusterProvided(peersFetcher, x))
                    });
            })
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
            .then(() => this._fetchProviders())
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

    invalidateAllClusters()
    {
        var clusters = this._repoStore.get('clusters', []);
        var clusterNames = _.keys(clusters);
        clusterNames = clusterNames.filter(x => this._isDeployed(x));
        return Promise.resolve()
            .then(() => this.setup())
            .then(() => Promise.serial(clusterNames, x => this._markClusterDirty(x)))
            .then(() => this._processDirtyClusters())
            ;
    }

    deployClusters(clusterNameOrNone)
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
                this._screen.error('Cluster %s not present.', clusterNameOrNone);
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

    undeployCluster(clusterName)
    {
        return Promise.resolve()
            .then(() => this._markUndeployedCluster(clusterName))
            .then(() => this._processDirtyClusters())
            ;
    }
    
    _markDeployedCluster(clusterName)
    {
        this._logger.info("[_markDeployedCluster] %s...", clusterName);
        return Promise.resolve()
            .then(() => this._repoStore.set('local-deployed-clusters', [clusterName], true))
            .then(() => this._markClusterDirty(clusterName))
            ;
    }

    _markUndeployedCluster(clusterName)
    {
        this._logger.info("[_markUndeployedCluster] %s...", clusterName);
        return Promise.resolve()
            .then(() => this._repoStore.delete('local-deployed-clusters', [clusterName]))
            .then(() => this._markClusterDirty(clusterName))
            ;
    }

    _processDirtyClusters()
    {
        return Promise.resolve()
            .then(() => this._determineImplicitClusters())
            .then(() => {
                var dirtyClusters = this._getDirtyClusters();
                this._logger.info("[_processDirtyClusters] Dirty Clusters: ", dirtyClusters)
                var clusterNames = _.keys(dirtyClusters);
                var nonPostponeClusterNames = clusterNames.filter(x => _.isNullOrUndefined(dirtyClusters[x].postpone));
                this._logger.info("[_processDirtyClusters] NonPostponeClusters: ", dirtyClusters)

                var postponeClusterNames = clusterNames.filter(x => _.isNotNullOrUndefined(dirtyClusters[x].postpone));
                postponeClusterNames = _.orderBy(postponeClusterNames, [x => dirtyClusters[x].postpone], ['asc'])
                this._logger.info("[_processDirtyClusters] PostponeClusters: ", postponeClusterNames)

                clusterNames = _.concat(nonPostponeClusterNames, postponeClusterNames)
                this._logger.info("[_processDirtyClusters] Final Dirty Clusters: ", clusterNames)

                return Promise.serial(clusterNames, x => this._processDirtyCluster(x, dirtyClusters[x]));
            })
            .then(() => {
                var clusterNames = _.keys(this._getDirtyClusters());
                if (clusterNames.length > 0) {
                    return this._processDirtyClusters();
                }
            })
    }

    _getDirtyClusters()
    {
        return this._repoStore.get('local-dirty-clusters', []);
    }

    _determineImplicitClusters()
    {
        this._logger.info('[_determineImplicitClusters] ...');
        return Promise.resolve()
            .then(() => {
                var explicitClusterDefinitionMap = this._getExplicitClusterDefinitions();
                this._logger.info('[_determineImplicitClusters] explicit clusters: ', _.keys(explicitClusterDefinitionMap));

                var flatDefinitions = [];
                for(var x of _.values(explicitClusterDefinitionMap)) 
                {
                    flatDefinitions = _.concat(flatDefinitions, x);
                }

                var loader = new Loader(this._logger);
                var registry = loader.fromDefinitions(flatDefinitions);
                this._logger.info('[_determineImplicitClusters] registry clusters: ', this._getClustersInfo(registry));
                var policyTarget = this._getPolicyTarget();
                this._logger.info('[_determineImplicitClusters] policyTarget: ', policyTarget);
                return Promise.resolve(registry.compile(this._logger, policyTarget))
                    .then(compiledRegistry => {
                        this._logger.info('[_determineImplicitClusters] compiled registry clusters: ', this._getClustersInfo(compiledRegistry));
                        var implicitClusters = compiledRegistry.clusters.filter(x => x.isCompiled);
                        return implicitClusters.map(x => x.name);
                    });
            })
            .then(desiredImplicitClusters => {
                this._logger.info('[_determineImplicitClusters] desiredImplicitClusters: ', desiredImplicitClusters);
                var currentImplicitClusters = this._getDeployedImplicitClusterNames();
                var delta = this._produceClusterDelta(desiredImplicitClusters, currentImplicitClusters);
                this._logger.info("[_determineImplicitClusters] delta: ", delta);
                return Promise.serial(delta, x => this._setupImplicitCluster(x.isPresent, x.name));
            });
    }

    _getClustersInfo(registry)
    {
        return registry.clusters.map(x => ({
            id: x.id,
            isImplicit: x.isImplicit,
            isCompiled: x.isCompiled
        }));
    }

    _setupImplicitCluster(isPresent, name)
    {
        this._logger.info("[_setupImplicitCluster] %s, isPresent: %s ", name, isPresent);
        return Promise.resolve()
            .then(() => {
                if (isPresent) {
                    var clusterSpec = {
                        name: name,
                        isImplicit: true,
                        definitions: [{
                            kind: 'cluster',
                            name: name
                        }]
                    }
                    this._configRegistry.set('clusters', [name], clusterSpec);
                    return this._markDeployedCluster(name);
                } else {
                    this._configRegistry.clear('clusters', [name]);
                    return this._markUndeployedCluster(name);
                }
            })
            .then(() => this._markClusterDirty(name))
    }

    _produceClusterDelta(desiredImplicitClusters, currentImplicitClusters)
    {
        this._logger.info("[_produceClusterDelta] desiredImplicitClusters, currentImplicitClusters. ", 
            desiredImplicitClusters, currentImplicitClusters);

        var delta = [];
        desiredImplicitClusters = _.makeDict(desiredImplicitClusters, x => x, x => true);
        currentImplicitClusters = _.makeDict(currentImplicitClusters, x => x, x => true);

        for(var x of _.keys(desiredImplicitClusters)) {
            if (!(x in currentImplicitClusters)) {
                delta.push({
                    isPresent: true,
                    name: x
                });
            }
        }
        for(var x of _.keys(currentImplicitClusters)) {
            if (!(x in desiredImplicitClusters)) {
                delta.push({
                    isPresent: false,
                    name: x
                });
            }
        }
        return delta;
    }

    _getExplicitClusterDefinitions() 
    {
        var clusters = this._repoStore.get('clusters', []);
        var explicitClusterNames = 
            _.values(clusters)
             .filter(x => !x.isImplicit)
             .map(x => x.name);
        this._logger.info("[_getExplicitClusterDefinitions] explicitClusterNames: ", explicitClusterNames)
        var result = {}
        for(var clusterName of explicitClusterNames) {
            if (this._isDeployed(clusterName)) {
                result[clusterName] = clusters[clusterName].definitions;
            }
        }
        return result;
    }

    _getDeployedImplicitClusterNames() 
    {
        var names = [];
        var clusters = this._repoStore.get('clusters', []);
        for(var clusterName of _.keys(clusters))
        {
            var clusterInfo = clusters[clusterName];
            if (clusterInfo.isImplicit)
            {
                if (this._isDeployed(clusterName)) {
                    names.push(clusterName);
                }
            }
        }
        return names;
    }

    _isDeployed(clusterName)
    {
        var isDeployed = this._repoStore.get('local-deployed-clusters', [clusterName]);
        if (isDeployed) {
            this._logger.info('[_isDeployed] %s IS DEPLOYED...', clusterName);
            return true;
        }
        this._logger.info('[_isDeployed] %s IS NOT DEPLOYED...', clusterName);
        return false;

    }

    _processDirtyCluster(clusterName, dirtyInfo)
    {
        this._logger.info('[_processDirtyCluster] %s...', clusterName, dirtyInfo);
        this._clearClusterDirty(clusterName);
        var isDeployed = this._isDeployed(clusterName);
        this._logger.info('[_processDirtyCluster] %s, isDeployed=%s', clusterName, isDeployed);
        if (isDeployed)
        {
            return this._processCluster(clusterName, 'deploy', dirtyInfo);
        }
        else
        {
            return this._processCluster(clusterName, 'undeploy', dirtyInfo);
        }
    }

    _fetchProviders()
    {
        var providerNames = this._getProviderNames();
        this._logger.info("[_fetchProviders] Provider Names: ", providerNames)

        return Promise.serial(providerNames, x => this._fetchProviderCredentials(x))
            .then(() => {
                this._logger.info("[_fetchProviders] Providers Data: ", this._providers)
            });
    }

    _getProviderNames()
    {
        var providerNames = []

        var activeProvider = this._configRegistry.get('config', 'active-local-provider');
        if (activeProvider)
        {
            var localProviderConfig = this._configRegistry.get('config', 'local-provider');
            this._logger.info("[_getProviderNames] localProviderConfig: ", localProviderConfig)
            if (activeProvider in localProviderConfig)
            {
                providerNames.push(activeProvider);
            }
        }

        return providerNames;
    }

    _fetchProviderCredentials(providerName)
    {
        this._logger.info('[_fetchProviderCredentials] provider: %s...', providerName);
        var provider = this._configRegistry.get('config', ['local-provider', providerName]);
        
        if (providerName == 'aws') {
            var region = provider.region;
            if (!region) {
                region = 'us-east-1';
            }
            return new Promise((resolve, reject) => {
                var options = {
                    profile: provider.profile
                }
                awscred.loadCredentialsFromIniFile(options, (err, data) => {
                    if (err) throw err
                    this._logger.info('[_fetchProviderCredentials] %s. credentials: ', providerName, data);
                    if (data.accessKeyId && data.secretAccessKey) {
                        var providerData = {
                            name: providerName,
                            profile: provider.profile,
                            region: region,
                            credentials: {
                                key: data.accessKeyId,
                                secret: data.secretAccessKey
                            }
                        };
                        this._providers[providerName] = providerData;
                    }
                    resolve();
                })
            });
        }

        if (providerName == 'gcp')
        {
            var region = provider.region;
            if (!region) {
                region = 'us-central1';
            }
            var providerData = {
                name: providerName,
                region: region,
                credentials: provider.credentials
            };
            this._providers[providerName] = providerData;
            return;
        }
        
        throw new Error(`Provider ${providerName} is not supported.`);
    }

    _loadClusterRegistry(clusterName)
    {
        var clusterSpec = this._repoStore.get('clusters', [clusterName]);
        if (!clusterSpec) {
            this._logger.warn("[_loadClusterRegistry] %s, clusterSpec is null...", clusterName);
            return null;
        }
        var clusterDefinitions = clusterSpec.definitions;
        if (!clusterDefinitions) {
            this._logger.warn("[_loadClusterRegistry] %s, clusterDefinitions is null...", clusterName);
            return null;
        }
        var policyTarget = this._getPolicyTarget(clusterName);
        return Promise.resolve(this._parseDefinitions(clusterDefinitions))
            .then(registry => {
                return registry.produceDeploymentRegistry(this._logger, policyTarget, clusterName)
            });
    }

    _getPolicyTarget(clusterName)
    {
        var policyTarget = {
            deployment: 'local',
            provider: 'local',
            providerKind: 'local',
        }
        if (clusterName) {
            policyTarget = clusterName;
        }
        return policyTarget;
    }

    _loadClusterEntity(clusterName)
    {
        return Promise.resolve(this._loadClusterRegistry(clusterName))
            .then(registry => {
                if (!registry) {
                    this._logger.warn("[_loadClusterEntity] %s, registry is null...", clusterName);
                    return null;
                }
                var clusterEntity = registry.getCluster(clusterName);
                return clusterEntity;
            })
    }

    _processCluster(clusterName, action, dirtyInfo)
    {
        this._screen.info('Processing cluster %s %s...', clusterName, action);
        this._logger.info('[_processCluster] BEGIN %s...', clusterName, dirtyInfo);
        var stage = 'single-stage-' + action;
        return Promise.resolve()
            .then(() => {
                if (dirtyInfo.postpone) {
                    var postponeDate = new Date(dirtyInfo.postpone);
                    this._logger.info('[_processCluster] postponeDate: %s', postponeDate);

                    var diff = new DateDiff(postponeDate, new Date());
                    var diffSec = diff.seconds();
                    this._logger.info('[_processCluster] postpone diff seconds: %s', diffSec);

                    if (diffSec > 0) {
                        diffSec = parseInt(diffSec, 10);
                        if (diffSec > 60) {
                            diffSec = 60;
                        }
                        this._screen.info('Waiting %s seconds to process cluster %s...', diffSec, clusterName);
                        return Promise.timeout(diffSec * 1000);
                    }
                }
            })
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
                    return null;
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

                var metadataProcessor = new MetadataProcessor(
                    this._logger.sublogger("MetadataProcessor"),
                    this._tableImpl,
                    scope
                );

                this._dirtyEndpointServices = {};

                var processor = new LocalProcessor(this._logger.sublogger('LocalProc'), this._repoStore, this._docker, this._screen, this._shell);
                processor._iterationNumber = this._iterationNumber;
                processor.setBerliozCommon(BeriozCommon);
                processor.tableImplementation(this._tableImpl);
                processor.endpointProcessor(endpointProcessor);
                processor.setMetadataProcessor(metadataProcessor);
                processor.peersFetcher(this._createPeersFetcher());
                processor.makeQuick(this._isQuick);
                for(var provider of this.providersConfig) {
                    var providerClient = this.getProviderClient(provider.name);
                    processor.providerConfig(provider.name, 
                                             provider, 
                                             providerClient);
                }
                processor.cluster(clusterEntity);
                processor.repositories(clusterRepositories);
                return processor.perform(stage);
            })
            .then(result => {
                this._logger.info('[_processCluster] END %s...', clusterName, result);
                if (!result) {
                    return;
                }
                if (result.needMore) {
                    this._markClusterDirty(clusterName);
                    if (result.postponeTill) {
                        this._markClusterPostpone(clusterName, result.postponeTill);
                    }
                }
                // this._screen.info('Cluster %s %sed successfully.', clusterName, action);
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
        this._repoStore.set('local-dirty-clusters', [clusterName, 'dirty'], true);
    }

    _markClusterPostpone(clusterName, postpone)
    {
        this._logger.info('[_markClusterPostpone] %s postpone till %s', clusterName, postpone);
        this._repoStore.set('local-dirty-clusters', [clusterName, 'postpone'], postpone.toString());
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
