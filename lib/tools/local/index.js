const Promise = require('the-promise');
const _ = require('the-lodash');
const Path = require('path');
const fs = require('fs');
const os = require('os');
const ip = require('ip');
const uuid = require('uuid/v4');

const ModelProcessor = require('processing-tools/model-processor')

const ClusterProcessor = require('./cluster-processor');
const TaskMetadataStore = require('./task-metadata-store');

class LocalProcessor extends ModelProcessor
{
    constructor(logger, repoStore, docker, screen, shell, environment)
    {
        super(logger);

        this._repoStore = repoStore;
        this._docker = docker;
        this._screen = screen;
        this._shell = shell;
        this._environment = environment;
        this._clusterProcessor = null;
        this._berliozAgentExternalIpAddress = null;
        this._berliozAgentExternalPort = null;

        this._berliozCommon = null;
        this._providers = {};

        this._nativeProcessor = null;
        this._gcpServiceAPIs = [];

        this._modelsDirLocation = __dirname;
        this._metaContext.docker = this._docker;
        this._metaContext.screen = this._screen;
        this._metaContext.aws = null;
        this._metaContext.autoconfigAwsObject = this.autoconfigAwsObject.bind(this)
        this._metaContext.deployment = 'local' + this._constructHostName();
        this._logger.info('LOCAL DEPLOYMENT: %s...', this._metaContext.deployment);

        this.setupStage('prepare-common-images', () => this._prepareCommonImages());
        
        this._repositories = {};
        this._providedRepositories = {};

        this.setupStage('iteration-init', () => {
            this._logger.info('MASSAGED REPOSITORIES: ', this._repositories);
            this.setSingleStageData('repositories', this._repositories);
            return this._outputDataToFile('repositories', this._repositories);
        });

        this.setupStage('single-stage-deploy', () => {
            this._iterationStages.preSetup = ['preSetup'];
            this._iterationStages.iterationInit = ['prepare-common-images', 'iteration-init', 'setup-docker-network'] ;
            this._iterationStages.constructDesired = 'construct-desired';
            this._iterationStages.stabilizeCurrent = ['reserve-network-resources', 'massage-key-aliases'];
            // this._iterationStages.postExtractCurrent = null;
            this._iterationStages.postProcessDelta = ['massage-key-aliases', 'fetch-berlioz-agent-task', 'deploy-task-metadata'];
            return this.runStage('process-iteration');
        });

        this.setupStage('single-stage-undeploy', () => {
            this._iterationStages.preSetup = ['preSetup'];
            this._iterationStages.iterationInit = 'iteration-init';
            this._iterationStages.constructDesired = ['construct-undeploy', 'cleanup-metadata-processor'];
            this._iterationStages.stabilizeCurrent = ['reserve-network-resources', 'massage-key-aliases'];
            // this._iterationStages.postExtractCurrent = null;
            this._iterationStages.postProcessDelta = ['massage-key-aliases', 'fetch-berlioz-agent-task', 'deploy-task-metadata'];
            return this.runStage('process-iteration');
        });

        this.setupStage('preSetup', () => {
            return this._preSetup();
        });

        this.setupStage('setup-docker-network', () => {
            return this._setupDockerNetwork();
        });

        this.setupStage('construct-desired', () => {
            return this._constructDesiredConfig();
        });

        this.setupStage('construct-undeploy', () => {
            return this._constructUndeployConfig();
        });

        this.setupStage('deploy-task-metadata', () => {
            return this._deployTaskMetadata();
        });

        this.setupStage('reserve-network-resources', () => {
            return this._reserveNetworkResources();
        });

        this.setupStage('fetch-berlioz-agent-task', () => {
            return this._fetchBerliozAgentTask();
        });

        this.setupStage('massage-key-aliases', () => {
            return this._massageKeyAliases();
        });

        this.setupStage('cleanup-metadata-processor', () => {
            return this._cleanupMetadataProcessor();
        });
    }

    get agentHostName() {
        return 'agent1.main.berlioz';
    }

    get agentPort() {
        return '55555';
    }

    get agentHostPort() {
        return this.agentHostName + ':' + this.agentPort;
    }

    get berliozAgentExternalIpAddress() {
        return this._berliozAgentExternalIpAddress;
    }

    get berliozAgentExternalPort() {
        return this._berliozAgentExternalPort;
    }

    get berliozAgentExternalHostPort() {
        if (!this.berliozAgentExternalIpAddress) {
            return null;
        }
        if (!this.berliozAgentExternalPort) {
            return null;
        }
        return this.berliozAgentExternalIpAddress + ':' + this.berliozAgentExternalPort;
    }

    tableImplementation(value)
    {
        this._tableImpl = value;
    }

    endpointProcessor(value)
    {
        this._endpointProcessor = value;
    }

    peersFetcher(value)
    {
        this._peersFetcher = value;
    }

    setMetadataProcessor(value) {
        this._metadataProcessor = value;
    }

    get metadataProcessor() {
        return this._metadataProcessor;
    }

    get nativeProcessor() {
        return this._nativeProcessor;
    }

    _constructHostName() {
        var hostname = os.hostname();
        this._logger.info('HOSTNAME: %s...', hostname);
        var dotIndex = hostname.indexOf('.');
        if (dotIndex >= 0) {
            hostname = hostname.substr(0, dotIndex);
        }
        hostname = hostname.replace(/-/g, '');
        hostname = hostname.replace(/_/g, '');
        hostname = hostname.replace(/:/g, '');
        hostname = hostname.replace(/\./g, '');
        return hostname;
    }

    get deploymentName() {
        return this._metaContext.deployment;
    }

    get clusterEntity() {
        return this._clusterEntity;
    }

    get clusterName() {
        return this.clusterEntity.name;
    }

    get repoStore() {
        return this._repoStore;
    }

    get awsClient() {
        return this._awsClient;
    }

    get gcpClient() {
        return this._gcpClient;
    }

    get hasAwsProvider() {
        return 'aws' in this._providers;
    }

    get hasGcpProvider() {
        return 'gcp' in this._providers;
    }

    makeQuick(value) {
        this._isQuick = value;
    }

    providerConfig(name, config, client)
    {
        this._logger.info('Provider Config - %s: ', name, config);
        this._providers[name] = {
            name: name,
            config: config,
            client: client
        };
    }

    getRootWorkingPath()
    {
        return Path.resolve(os.homedir(), '.berlioz', 'deployment');
    }

    getServiceWorkingPath(serviceEntity)
    {
        var p = this.getRootWorkingPath();
        for(var x of serviceEntity.naming) 
        {
            p = Path.resolve(p, x); 
        }
        return p;
    }

    getLoadBalancerWorkingPath(serviceEntity, endpoint)
    {
        return Path.resolve(this.getServiceWorkingPath(serviceEntity), endpoint);
    }

    sanitizePath(directory)
    {
        this._shell.shell.mkdir('-p', directory);
        return directory;
    }

    writeToFile(filePath, contents)
    {
        return new Promise((resolve, reject) => {
            var dirName = Path.dirname(filePath);
            this.sanitizePath(dirName);
            fs.writeFile(filePath, contents, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    readFromFile(filePath)
    {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
            });
        });
    }

    setBerliozCommon(value)
    {
        this._berliozCommon = value;
    }

    perform(stageAction)
    {
        return Promise.resolve()
            .then(() => this._perform(stageAction, 3))
            ;
    }

    _perform(stageAction, count)
    {
        if (count <= 0) {
            return;
        }

        this._logger.info('***********************************************************');
        this._logger.info('***********************************************************');
        this._logger.info('***********************************************************');
        return this.runStage(stageAction)
            .then(result => {
                this._logger.info('[_perform] %s completed. Run result: ', stageAction, result);
                this._lastDeltaConfig = this.singleStageData['finalDelta'];

                var shouldRetry = false;
                if (!result) {
                    shouldRetry = true;
                } else {
                    if (result.needMore) {
                        shouldRetry = true;
                    }
                }
                // TODO: TEMP
                shouldRetry = false;
                if (shouldRetry)
                {
                    this._logger.info('[_perform] NEED MORE STAGES TO PROCESS');
                    return this._perform(stageAction, count - 1);
                }
                return result;
            });
    }

    _prepareCommonImages()
    {
        if (!this._repositories) {
            this._repositories = {};
        }
        return Promise.resolve()
            .then(() => this._prepareHelperImage('load-balancer', 'million12/haproxy'))
            .then(() => this._clusterProcessor.prepareCommonImages(this._repositories))
            .then(() => {
                if (this._providedRepositories) {
                    this._repositories = _.defaults(this._repositories, this._providedRepositories);
                }
            })
    }

    _getHelperImageId(name)
    {
        return 'helper-service://' + name;
    }

    getImage(id)
    {
        if (id in this._repositories) {
            return this._repositories[id];
        }
        return null;
    }

    getHelperImage(name)
    {
        return this.getImage(this._getHelperImageId(name))
    }

    getImageInfo(imageName)
    {
        return Promise.resolve()
            .then(() => this._docker.pullImage(imageName, this._isQuick))
            .then(() => this._docker.getImage(imageName))
            .then(result => ({
                kind: 'docker',
                name: imageName,
                digest: result.Id
            }));
    }

    _prepareHelperImage(name, imageName)
    {
        var id = this._getHelperImageId(name)
        if (id in this._repositories) {
            return;
        }
        return Promise.resolve()
            .then(() => this.getImageInfo(imageName))
            .then(result => {
                this._repositories[id] = result
            });
    }

    cluster(cluster)
    {
        if (!cluster._registry) {
            throw new Error('Cluster not linked to registry');
        }
        this._clusterEntity = cluster;
        this._metaContext.cluster = cluster.name;

        this._outputEntity(cluster);
        for(var service of cluster.services)
        {
            this._outputEntity(service);
            for(var provided of _.values(service.provides))
            {
                this._outputEntity(provided);
                this._logger.info('END %s', provided.id);
            }
            this._logger.info('END %s', service.id);
        }
        this._logger.info('END %s', cluster.id);
        for(var policy of cluster._registry.policies)
        {
            this._outputEntity(policy);
        }

        this._clusterProcessor = new ClusterProcessor(this, this._logger, cluster);
    }

    repositories(value)
    {
        this._providedRepositories = _.clone(value);
        this._logger.info('PROVIDED REPOSITORIES: ', value);
    }

    _outputEntity(entity)
    {
        var data = [];
        entity.extractData(data);
        this._logger.info('BEGIN %s', entity.id);
        for(var row of data)
        {
            this._logger.info('    %s = %s', row[0], row[1]);
        }
    }

    _fetchBerliozAgentTask()
    {
        var agentFilters = {
            'berlioz:kind': 'task',
            'berlioz:cluster': 'berlioz',
            'berlioz:sector': 'main',
            'berlioz:service': 'agent'
        };
        return Promise.resolve()
            .then(() => this._docker.listContainersByKind(agentFilters))
            .then(containers => {
                if (containers.length == 0) {
                    return;
                }
                if (containers.length > 1) {
                    this._logger.error('[_fetchBerliozAgentTask] ', containers);
                    throw new Error('Too many Berlioz Agents found.');
                }
                var container = containers[0];
                this._berliozAgentExternalIpAddress = this.getDockerHost();
                this._berliozAgentExternalPort = _.get(container, 'NetworkSettings.Ports["' + this.agentPort + '/tcp"][0].HostPort', null);
                this._logger.info('[_fetchBerliozAgentTask] BerliozAgentIpAddress: ', this._berliozAgentExternalIpAddress);
                this._logger.info('[_fetchBerliozAgentTask] BerliozAgentExternalPort: ', this._berliozAgentExternalPort);
            });
    }

    getDockerHost()
    {
        return this._docker.host;
        // var val = this._environment.getValue('BERLIOZ_DOCKER_HOST');
        // if (val)
        // {
        //     return val;
        // }
        // return '127.0.0.1';
    }

    _deployTaskMetadata()
    {
        this._taskMetaStore = new TaskMetadataStore(this,
            this._logger.sublogger('TaskMetaStore'),
            this._configMeta,
            this.clusterEntity,
            this._currentConfig);
            
        return Promise.resolve()
            .then(() => this._taskMetaStore.extract())
            .then(() => this._outputTaskMetadataRepos())
            .then(() => this._taskMetaStore.deploy())
            ;
    }

    _setupEndpointsInStore(name, dict)
    {
        if (!dict || _.keys(dict).length == 0)
        {
            this._repoStore.delete(name, [this.clusterName]);
        }
        else {
            this._repoStore.set(name, [this.clusterName], dict);
        }
    }

    _outputTaskMetadataRepos()
    {
        for(var name of this._taskMetaStore.repoStore.repos)
        {
            var repo = this._taskMetaStore.repoStore.getRepository(name);
            this.setSingleStageData('taskmeta-' + name, repo);
        }
        return this._taskMetaStore.outputRepositories();
    }

    _cloneFromCurrentConfig()
    {
        return Promise.resolve()
            .then(() => {
                if (this._currentConfig) {
                    var tasksToClone = [];
                    this._clusterProcessor.extractTasksToClone(this._currentConfig, tasksToClone);
                    return Promise.serial(_.values(tasksToClone), x => {
                        this._logger.info('[_cloneFromCurrentConfig] %s', x.dn);
                        return this._desiredConfig.section('task').cloneSingleItemFrom(x, true);
                    })
                }
            })
    }

    _constructDesiredConfig()
    {
        this._nativeProcessor.setupDesiredConfig(this._desiredConfig);

        this._logger.info('***********************************************************');
        this._logger.info('*************** CONSTRUCT DESIRED *************************');
        this._logger.info('***********************************************************');
        return Promise.resolve()
            .then(() => this._cloneFromCurrentConfig())
            .then(() => this.nativeProcessor.constructBaseConfig())
            .then(() => this._clusterProcessor.constructConfig(this._desiredConfig))
            ;
    }

    _constructUndeployConfig()
    {
        return Promise.resolve()
            .then(() => this.nativeProcessor.constructBaseConfig())
    }

    _finalizeSetup()
    {
        return Promise.resolve()
            .then(() => {
                if (this._clusterProcessor) {
                    return this._clusterProcessor.finalizeSetup();
                }
            });
    }

    _reserveNetworkResources()
    {
        this._reservedHostPorts = {};
        this._taskBindings = {};
        return this._docker.listContainers()
            .then(containers => Promise.serial(containers, x => this._reserveContainerResources(x)))
            .then(() => this._outputDataToFile('initial_reservedHostPorts', this._reservedHostPorts))
            .then(() => this._outputDataToFile('initial_taskBindings', this._taskBindings))
            ;
    }

    _cleanupMetadataProcessor()
    {
        this._logger.info('[_cleanupMetadataProcessor] ...')
        return Promise.resolve()
            .then(() => this._metadataProcessor.cleanup());
    }

    _massageKeyAliases()
    {
        if (!this._currentConfig) {
            return;
        }
        return this._clusterProcessor._massageKeyAliases(this._currentConfig);
    }

    _outputDataToFile(name, data)
    {
        return this._logger.outputFile(this._iterationNumber + '_' + name + '.json', data);
    }

    _reserveContainerResources(container)
    {
        var kind = this.getContainerLabel(container, 'berlioz:kind');
        var naming = this.parseContainerTaskNaming(container);
        var itemDn = null;
        if (kind && naming)
        {
            itemDn = this._configMeta.constructDn(kind, naming);
        }

        for(var binding of this.parseContainerPortBingings(container))
        {
            this._reservedHostPorts[binding.hostPort] = true;
            if (itemDn) {
                this.reserveBindingForTask(itemDn, binding.protocol, binding.port, binding.hostPort);
            }
        }
    }

    reserveBindingForTask(taskDn, protocol, port, hostPort)
    {
        this._logger.info('[reserveBindingForTask] task: %s, protocol: %s, port: %s => %s', taskDn, protocol, port, hostPort);
        port = parseInt(port);
        hostPort = parseInt(hostPort);
        if (!this._taskBindings[taskDn]) {
            this._taskBindings[taskDn] = {};
        }
        if (!this._taskBindings[taskDn][protocol]) {
            this._taskBindings[taskDn][protocol] = {};
        }
        this._taskBindings[taskDn][protocol][port] = hostPort;
    }

    fetchTaskHostPort(taskDn, protocol, port)
    {
        this._logger.info('[fetchTaskHostPort] task: %s, protocol: %s, port: %s', taskDn, protocol, port);
        port = parseInt(port);
        var hostPort = this._fetchCurrentBindingForTask(taskDn, protocol, port);
        if (hostPort != null) {
            return hostPort;
        }

        for(hostPort = 40000; hostPort < 50000; hostPort++)
        {
            if (!this._reservedHostPorts[hostPort]) {
                this._reservedHostPorts[hostPort] = true;
                this.reserveBindingForTask(taskDn, protocol, port, hostPort);
                return hostPort;
            }
        }
    }

    _fetchCurrentBindingForTask(taskDn, protocol, port)
    {
        if (!this._taskBindings[taskDn]) {
            return null;
        }
        if (!this._taskBindings[taskDn][protocol]) {
            return null
        }
        if (!this._taskBindings[taskDn][protocol][port]) {
            return null;
        }
        return this._taskBindings[taskDn][protocol][port];
    }

    getContainerLabel(obj, name)
    {
        if (!obj.Config) {
            return null;
        }
        var value = obj.Config.Labels[name];
        return value;
    }

    parseContainerTaskNaming(obj)
    {
        var kind = this.getContainerLabel(obj, 'berlioz:kind');

        var naming = null;
        if (kind == 'task')
        {
            naming = [
                this.getContainerLabel(obj, 'berlioz:cluster'),
                this.getContainerLabel(obj, 'berlioz:sector'),
                this.getContainerLabel(obj, 'berlioz:service'),
                parseInt(this.getContainerLabel(obj, 'berlioz:identity'))
            ];
        }
        else if (kind == 'load-balancer')
        {
            naming = [
                this.getContainerLabel(obj, 'berlioz:cluster'),
                this.getContainerLabel(obj, 'berlioz:sector'),
                this.getContainerLabel(obj, 'berlioz:service'),
                this.getContainerLabel(obj, 'berlioz:endpoint')
            ];
        }

        if (!naming)
        {
            return null;
        }
        if (_.some(naming, x => (x == null))) {
            return null;
        }
        return naming;
    }

    autoconfigAwsObject(item, action)
    {
        if (!this._metaContext.aws) {
            this._screen.error('AWS profile is not set up. Cannot configure %s', item.dn);
            this._screen.error('Please setup AWS profile using "berlioz local account --profile <value>" command.');
            this._screen.info()
            return false;
        }
        return true;
    }

    parseContainerPortBingings(obj)
    {
        var bindings = [];
        for(var bindingStr of _.keys(obj.HostConfig.PortBindings))
        {
            var hostPort = obj.HostConfig.PortBindings[bindingStr][0].HostPort;
            var i = bindingStr.indexOf('/');
            var port = bindingStr.substring(0, i);
            var protocol = bindingStr.substring(i + 1);
            bindings.push({
                protocol: protocol,
                port: port,
                hostPort: hostPort
            });
        }
        return bindings;
    }

    getContainerIp(obj)
    {
        if (!obj) {
            return null;
        }
        return _.get(obj, "NetworkSettings.Networks.berlioz.IPAddress", null);
    }

    saveEncryptionKeys(allKeys)
    {
        this._logger.info('---- saveEncryptionKeys: ', allKeys)
        this._allEncryptionKeys = allKeys;
    }

    findEncryptionKey(tags) 
    {
        this._logger.info('---- findEncryptionKey. tags: ', tags)

        if (!this._allEncryptionKeys) {
            return null;
        }
        var myKeys = this._allEncryptionKeys.filter(x => this._kmsHasTags(x, tags));
        if (myKeys.length == 0) {
            return null;
        }

        var existingKeys = myKeys.filter(x => x.KeyState != 'PendingDeletion');
        if (existingKeys.length > 0) {
            return _.head(existingKeys);
        }

        return _.head(myKeys);
    }

    _kmsHasTags(keyObj, tags)
    {
        for(var tag of _.keys(tags)) {
            if (tags[tag] != keyObj.Tags[tag]) {
                return false;
            }
        }
        return true;
    }

    getGcpServiceAPIs()
    {
        return this._gcpServiceAPIs;
    }

    _preSetup()
    {
        this._customModelsDirLocations = [];

        this._nativeProcessor = this._berliozCommon.newNativeProcessor(this._logger, this);
        this._nativeProcessor.setupRepositories(this._repositories);

        return Promise.resolve()
            .then(() => this._setupGcp())
            .then(() => this._setupAws())
    }

    _getMyPublicIp() {
        if (this._myPublicIp) {
            return Promise.resolve(this._myPublicIp);
        }
        const publicIp = require('public-ip');
        return publicIp.v4()
            .then(result => {
                this._logger.info("[_getMyPublicIp] MY IP: ", result)
                this._myPublicIp = result;
                return this._myPublicIp;
            });
    }

    _setupGcp()
    {
        if (!this.hasGcpProvider) {
            return;
        }

        this._gcpMandatoryServiceAPIs = [
            'cloudresourcemanager.googleapis.com'
        ];

        this._gcpServiceAPIs = [
            'firestore.googleapis.com',
            'datastore.googleapis.com',
            'sqladmin.googleapis.com',
            'storage-api.googleapis.com',
            'pubsub.googleapis.com'
            // 'cloudresourcemanager.googleapis.com',
            // 'cloudfunctions.googleapis.com',
            // 'cloudkms.googleapis.com'
        ]

        this._customModelsDirLocations.push(this._berliozCommon.getModelsDir('gcp'));

        var provider = this._providers['gcp'];

        this._gcpClient = provider.client;
        this._metaContext.gcp = this.gcpClient;
        this._metaContext.region = this.gcpClient.region;
        this._metaContext.shortRegion = _.replaceAll(this.gcpClient.region, '-', '');
        this._metaContext.zone = this.gcpClient.zone;

        this._metaContext.gcpAccountId = provider.config.credentials.project_id;

        this._nativeProcessor.setupProviderPeerConfigHandler('gcp', (item) => {
            if (item.meta.name == 'gcp-sql') {
                if (item.obj) {
                    if (item.obj.ipAddresses) {
                        var address = _.head(item.obj.ipAddresses.filter(x => x.type == 'PRIMARY'));
                        if (address) {
                            return {
                                host: address.ipAddress,
                                user: 'root'
                            }
                        }
                    }
                }
                return {};
            }

            return {
                credentials: {
                    client_email: provider.config.credentials.client_email,
                    private_key: provider.config.credentials.private_key
                },
                projectId: provider.config.credentials.project_id
            };
        });

        this._nativeProcessor.setupCustomHandler('gcp-sql', ({item}) => {

            return this._getMyPublicIp()
                .then(result => {
                    this._logger.info('[setupCustomHandler] %s...', item.dn, item.config)
                    item.config.config.settings['ipConfiguration'] = {
                        ipv4Enabled: true,
                        authorizedNetworks: [
                            {
                                "kind": "sql#aclEntry",
                                "value": result,
                                "name": "local"
                            }
                        ]
                    }
                })
        });

        var nativeProcessorScope = {
            metaContext: this._metaContext,
            providerKind: 'gcp',
            deployment: this.deploymentName,
            gcpAccountId: provider.config.credentials.project_id,
            sourceRegion: this.gcpClient.sourceRegion,
            region: this.gcpClient.region,
            shortRegion: this._metaContext.shortRegion,
            zone: this.gcpClient.zone,
            projectId: provider.config.credentials.project_id,
            gcp: this._gcpClient,
            gcpMandatoryServiceAPIs: this._gcpMandatoryServiceAPIs
        }

        return Promise.resolve()
            .then(() => this._nativeProcessor.setupScope(nativeProcessorScope))
            .then(() => this._nativeProcessor.init())
    }

    _setupAws()
    {
        if (!this.hasAwsProvider) {
            return;
        }
        
        var provider = this._providers['aws'];

        if (provider.config.profile) {
            this._screen.info('Using AWS profile: %s', provider.config.profile);
        } else {
            this._screen.warn('No AWS profile provided. AWS native resources like DynamoDB and Kinesis would not be provisioned.');
            this._screen.warn('Set up AWS profile using \"berlioz local account\".');
        }
        
        this._awsClient = provider.client
        this._metaContext.aws = this.awsClient;
        this._metaContext.region = this.awsClient.region;
        this._metaContext.shortRegion = _.replaceAll(this.awsClient.region, '-', '');
        this._metaContext.zone = this.awsClient.region;

        this._nativeProcessor.setupProviderPeerConfigHandler('aws', (item) => {
            return {
                region: provider.config.region,
                credentials: provider.config.credentials
            };
        });
        this._nativeProcessor.setupScope({
            providerKind: 'gcp',
            deployment: this.deploymentName,
            // awsAccountId: provider.config.credentials.project_id,
            region: provider.config.region
        })
    }

    _setupDockerNetwork()
    {
        return Promise.resolve()
            .then(() => this._setupContainerNetwork())    
            .then(() => this._fetchContainerAddresses())    
    }

    allocateContainerAddress()
    {
        for(var x = ip.toLong(this._networkSubnet.firstAddress) + 1; x <= ip.toLong(this._networkSubnet.lastAddress); x++) {
            var addressStr = ip.fromLong(x);
            if (!this._usedIpAddresses[addressStr]) {
                this._usedIpAddresses[addressStr] = true;
                return addressStr;
            }
        }
        throw new Error('Could not allocate address.');
    }

    _setupContainerNetwork()
    {
        return this._docker.fetchNetwork("berlioz")
            .then(network => {
                this._networkSubnet = ip.cidrSubnet(network.IPAM.Config[0].Subnet);
                this._logger.info("Network: ", this._networkSubnet)
            })
    }

    _fetchContainerAddresses()
    {
        return this._docker.listContainers()
            .then(results => {
                return results.map(x => _.get(x, "NetworkSettings.Networks.berlioz.IPAddress", null))
            })
            .then(results => {
                return results.filter(x => x)
            })
            .then(results => {
                this._usedIpAddresses = _.makeDict(results, x => x, x => true);
                this._logger.info("Used Addresses: ", this._usedIpAddresses)
                // throw new Error(JSON.stringify(this._usedIpAddresses))
            });
    }

    getContainerLabels(obj)
    {
        if (!obj) {
            return {};
        }
        var labels = {};
        for(var key of _.keys(obj.Config.Labels))
        {
            if (_.startsWith(key, 'berlioz:'))
            {
                labels[key] = obj.Config.Labels[key];
            }
        }
        return labels;
    }

    getServiceAccountItem(email)
    {
        return null;
    }

    splitNaming(name, level, result)
    {
        if (!result) {
            result = [];
        }
        if (level === undefined) {
            level = 1;
        }
        if (level == 0) {
            if (name.length > 0) {
                result.push(name);
            }
            return result;
        }

        var index = name.indexOf('-');
        if (index != -1) {
            result.push(name.substr(0, index));
            return this.splitNaming(name.substr(index + 1), level - 1, result);
        } else {
            if (name.length > 0) {
                result.push(name);
            }
            return result;
        }
    }
}

module.exports = LocalProcessor;
