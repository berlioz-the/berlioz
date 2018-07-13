const Promise = require('the-promise');
const _ = require('the-lodash');
const Path = require('path');
const fs = require('fs');
const os = require('os');
const uuid = require('uuid/v4');

const ModelProcessor = require('processing-tools/model-processor')

const ClusterProcessor = require('./cluster-processor');
const TaskMetadataStore = require('./task-metadata-store');

const AWSClient = require('aws-sdk-wrapper');

class LocalProcessor extends ModelProcessor
{
    constructor(logger, repoStore, docker, screen, shell)
    {
        super(logger);

        this._repoStore = repoStore;
        this._docker = docker;
        this._screen = screen;
        this._shell = shell;
        this._clusterProcessor = null;

        this._modelsDirLocation = __dirname;
        this._metaContext.docker = this._docker;
        this._metaContext.screen = this._screen;
        this._metaContext.aws = null;
        this._metaContext.autoconfigAwsObject = this.autoconfigAwsObject.bind(this)
        var hostname = os.hostname();
        hostname = hostname.replace(/-/g, '');
        hostname = hostname.replace(/_/g, '');
        hostname = hostname.replace(/:/g, '');
        this._metaContext.deployment = 'local' + hostname;
        this._logger.info('LOCAL DEPLOYMENT: %s...', this._metaContext.deployment);

        this.setupStage('prepare-common-images', () => this._prepareCommonImages());

        this.setupStage('iteration-init', () => {
            this._logger.info('MASSAGED REPOSITORIES: ', this._repositories);
            this.setSingleStageData('repositories', this._repositories);
            return this._outputDataToFile('repositories', this._repositories);
        });

        this.setupStage('single-stage-deploy', () => {
            this._iterationStages.interationInit = ['prepare-common-images', 'iteration-init'] ;
            this._iterationStages.constructDesired = 'construct-desired';
            this._iterationStages.stabilizeCurrent = ['reserve-network-resources', 'massage-key-aliases'];
            this._iterationStages.postExtractCurrent = 'deploy-task-metadata';
            this._iterationStages.postProcessDelta = ['massage-key-aliases', 'produce-cluster-metadata'];
            return this.runStage('process-iteration');
        });

        this.setupStage('single-stage-undeploy', () => {
            this._iterationStages.interationInit = 'iteration-init';
            this._iterationStages.constructDesired = null;
            this._iterationStages.stabilizeCurrent = ['reserve-network-resources', 'massage-key-aliases'];
            this._iterationStages.postExtractCurrent = 'deploy-task-metadata';
            this._iterationStages.postProcessDelta = ['massage-key-aliases', 'produce-cluster-metadata'];
            return this.runStage('process-iteration');
        });

        this.setupStage('construct-desired', () => {
            return this._constructDesiredConfig();
        });

        this.setupStage('deploy-task-metadata', () => {
            return this._deployTaskMetadata();
        });

        this.setupStage('produce-cluster-metadata', () => {
            return this._produceClusterMetadata();
        });

        this.setupStage('reserve-network-resources', () => {
            return this._reserveNetworkResources();
        });

        this.setupStage('massage-key-aliases', () => {
            return this._massageKeyAliases();
        });

        

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

    makeQuick(value) {
        this._isQuick = value;
    }

    awsCredentials(credentials)
    {
        this._logger.info('AWS CREDENTIALS: %s...', credentials);
        this._awsCredentials = credentials;
        if (credentials)
        {
            var logger = this._logger.sublogger('AWSClient');
            this._awsClient = new AWSClient('us-east-1', credentials, logger);
            this._metaContext.aws = this._awsClient;
        }
    }

    getRootWorkingPath()
    {
        return Path.resolve(os.homedir(), '.berlioz', 'deployment');
    }

    getServiceWorkingPath(cluster, service)
    {
        return Path.resolve(this.getRootWorkingPath(), cluster, service);
    }

    getLoadBalancerWorkingPath(cluster, service, endpoint)
    {
        return Path.resolve(this.getServiceWorkingPath(cluster, service), endpoint);
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

    perform(stageAction)
    {
        return Promise.resolve()
            .then(() => this.setup())
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
                if (shouldRetry)
                {
                    this._logger.info('[_perform] NEED MORE STAGES TO PROCESS');
                    return this._perform(stageAction, count - 1);
                }
            });
    }

    _prepareCommonImages()
    {
        if (!this._repositories) {
            this._repositories = {};
        }
        return Promise.resolve()
            .then(() => this._prepareImage('berlioz/agent', 'berliozcloud/agent'))
            .then(() => this._prepareImage('berlioz/zipkin', 'openzipkin/zipkin'))
            .then(() => this._prepareImage('berlioz/load-balancer', 'million12/haproxy'))
    }

    _prepareImage(name, imageName)
    {
        if (name in this._repositories) {
            return;
        }

        return Promise.resolve()
            .then(() => this._docker.pullImage(imageName, this._isQuick))
            .then(() => this._docker.getImage(imageName))
            .then(result => this._repositories[name] = {
                image: imageName,
                digest: result.Id
            });
    }

    cluster(cluster)
    {
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

        this._clusterProcessor = new ClusterProcessor(this, this._logger, cluster);
    }

    repositories(value)
    {
        this._repositories = _.clone(value);
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

    _deployTaskMetadata()
    {
        return Promise.resolve()
            .then(() => {
                this._taskMetaStore = new TaskMetadataStore(this,
                                                            this._logger.sublogger('TaskMetaStore'),
                                                            this._configMeta,
                                                            this.clusterEntity,
                                                            this._currentConfig);
                this._taskMetaStore.markSuppressDeploy();
                return Promise.resolve()
                    .then(() => this._taskMetaStore.extract())
                    .then(() => this._outputTaskMetadataRepos())
                    ;
            })
            .then(() => this._taskMetaStore.deploy())
            ;
    }

    _produceClusterMetadata()
    {
        return Promise.resolve()
            .then(() => this._taskMetaStore.produceClusterEndpoints())
            .then(() => this._outputTaskMetadataRepos())
            .then(() => this._setupEndpointsInStore('local-endpoints-external', this._taskMetaStore.externalByCluster))
            .then(() => this._setupEndpointsInStore('local-endpoints-public', this._taskMetaStore.publicByCluster))
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
        if (this._currentConfig) {
            return Promise.resolve()
                .then(() => {
                    var tasksToClone = [];
                    this._clusterProcessor.extractTasksToClone(this._currentConfig, tasksToClone);
                    return Promise.serial(tasksToClone, x => {
                        this._logger.info('[_cloneFromCurrentConfig] %s', x.dn);
                        return this._desiredConfig.section('task').cloneSingleItemFrom(x, true);
                    })
                })
                ;
        }
    }

    _constructDesiredConfig()
    {
        return Promise.resolve()
            .then(() => this._cloneFromCurrentConfig())
            .then(() => this._clusterProcessor.constructConfig(this._desiredConfig))
            ;
    }

    _finalizeSetup()
    {
        if (this._awsCredentials) {
            this._screen.info('Using AWS profile: %s', this._awsCredentials.profile);
        } else {
            this._screen.warn('No AWS profile provided. AWS native resources like DynamoDB and Kinesis would not be provisioned.');
            this._screen.warn('Set up AWS profile using \"berlioz local account\".');
        }

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
                this.getContainerLabel(obj, 'berlioz:service'),
                parseInt(this.getContainerLabel(obj, 'berlioz:identity'))
            ];
        }
        else if (kind == 'load-balancer')
        {
            naming = [
                this.getContainerLabel(obj, 'berlioz:cluster'),
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

    getBerliozAgentPort()
    {
        return 55555;
    }

    getBerliozZipkinPort()
    {
        return 9411;
    }

    getContainerIp(obj)
    {
        if (!obj) {
            return null;
        }
        return obj.NetworkSettings.Networks.bridge.IPAddress;
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
