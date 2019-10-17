const Promise = require('the-promise');
const _ = require('the-lodash');
const uuid = require('uuid/v4');
const keypair = require('keypair');

const BaseItem = require('../../berlioz-common/entities/base');
const DependencyResolver = require('processing-tools/dependency-resolver');
const SubnetAllocator = require('processing-tools/subnet-allocator');
const PortAllocator = require('processing-tools/port-allocator');

const SectorProcessor = require('./sector-processor');

class ClusterProcessor
{
    constructor(rootProcessor, logger, clusterEntity)
    {
        this._rootProcessor = rootProcessor;
        this._logger = logger;
        this._clusterEntity = clusterEntity;
       
        this._sectorProcessors = {};
        for (var sector of this.clusterEntity.sectors)
        {
            this._sectorProcessors[sector.name] = new SectorProcessor(this, sector);
        }
    }

    get logger() {
        return this._logger;
    }

    get clusterEntity() {
        return this._clusterEntity;
    }

    get name() {
        return this.clusterEntity.name;
    }

    get sectorProcessors() {
        return _.values(this._sectorProcessors);
    }

    get rootProcessor() {
        return this._rootProcessor;
    }

    get currentConfig() {
        return this.rootProcessor._currentConfig;
    }

    get deploymentName() {
        return this.rootProcessor.deploymentName;
    }

    get metadataProcessor() {
        return this.rootProcessor.metadataProcessor;
    }

    get endpointProcessor() {
        return this.rootProcessor.endpointProcessor;
    }

    get peersFetcher() {
        return this.rootProcessor.peersFetcher;
    }

    get nativeProcessor() {
        return this.rootProcessor.nativeProcessor;
    }
    
    get hasAwsProvider() {
        return this.rootProcessor.hasAwsProvider;
    }

    get hasGcpProvider() {
        return this.rootProcessor.hasGcpProvider;
    }

    getSectorProcessor(name) {
        return this._sectorProcessors[name];
    }

    finalizeSetup()
    {
        return Promise.resolve()
            .then(() => Promise.serial(this.sectorProcessors, x => x.finalizeSetup()))
            .then(() => this.endpointProcessor.processClusterDependencies(this.clusterEntity))
            .then(() => this.peersFetcher.prefetchClusterDependencies(this.clusterEntity));
    }

    extractTasksToClone(config, tasksToClone)
    {
        for(var task of config.section('task').items)
        {
            if (this._shouldCloneTask(task)) {
                tasksToClone.push(task);
            }
        }
    }

    _shouldCloneTask(task)
    {
        var sectorName = task.config.labels["berlioz:sector"];
        var serviceName = task.config.labels["berlioz:service"];
        var serviceEntity = this.clusterEntity.getServiceByNaming(sectorName, serviceName);
        if (serviceEntity) {
            return true;
        }
        return false;
    }

    constructConfig(config)
    {
        this._logger.info('[cluster::constructConfig] %s', this.name);
        return Promise.resolve()
            .then(() => this.metadataProcessor.start(this.clusterEntity))
            .then(() => this._preConstructInit())
            .then(() => this.nativeProcessor.constructConfig(config, this.clusterEntity))
            .then(() => this._processSectors(config))
            .then(() => this._finalizeConstruct(config))
            .then(() => this.metadataProcessor.finish())
            ;
    }

    prepareCommonImages(repositories)
    {
        var services = this.clusterEntity.services.filter(x => {
            if (x.definition.code) {
                if (x.definition.code.image) {
                    return true;
                }
            }
            return false;
        })
        return Promise.serial(services, x => this._prepareServiceImage(repositories, x))
    }

    _prepareServiceImage(repositories, serviceEntity)
    {
        this._logger.info('[cluster::_prepareServiceImage] %s...', serviceEntity.id);
        if (serviceEntity.id in repositories) {
            return;
        }
        return Promise.resolve()
            .then(() => this.rootProcessor.getImageInfo(serviceEntity.definition.code.image))
            .then(result => {
                repositories[serviceEntity.id] = result
            });
    }

    _preConstructInit()
    {
        for(var sectorProcessor of this.sectorProcessors)
        {
            sectorProcessor.preConstructInit();
        }
    }

    _processSectors(config)
    {
        var sectors = this.clusterEntity.sectors;
        return Promise.serial(sectors, x => this._constructSector(config, x));
    }

    _constructSector(config, sector)
    {
        this._logger.info('[_constructSector] sector: %s', sector.id);

        var sectorProcessor = this.getSectorProcessor(sector.name);
        return sectorProcessor.constructConfig(config);
    }

    _finalizeConstruct(config)
    {

    }

    markNewStageNeeded(reason)
    {
        return this.rootProcessor.markNewStageNeeded(reason);
    }

    _setupReadyContainerObject(config, item)
    {
        var readyObject = config.section('ready-' + item.meta.name).create(item.naming);
        readyObject.setConfig('naming', item.naming);
        return Promise.resolve()
            .then(() => readyObject.relation(item))
            .then(() => readyObject)
            ;
    }

    _massageKeyAliases(config)
    {
        var keyMap = {}
        for(var key of config.section('encryption-key').items)
        {
            keyMap[key.id] = key
        }

        return Promise.serial(config.section('encryption-key-alias').items, alias => {
            var keyId = alias.obj.TargetKeyId;
            var key = keyMap[keyId];
            if (_.isNotNullOrUndefined(key)) {
                return alias.relation(key);
            } else {
                // TODO: check this logic. used to be key.remove().
                alias.remove();
            }
        })
    }

}

module.exports = ClusterProcessor;
