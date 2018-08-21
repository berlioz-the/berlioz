const PlantUml = require('./plantuml');
const _ = require('the-lodash');
const BaseItem = require('../berlioz-common/entities/base');

class RegistryDiagramGenerator
{
    constructor(logger, registry)
    {
        this._logger = logger;
        this._registry = registry;
        this._renderServiceConsumerAgent = true;
        this._serviceComponentBackground = '#LightBlue';
        this._compiledServiceComponentBackground = '#B1A0C7';
        this._publicToEndpointArrowColor = '#Crimson';
        this._externalToEndpointArrowColor = '#OrangeRed';
        this._internalToEndpointArrowColor = '#LightCoral';
        this._toSecretArrowColor = '#3a4ec1';
    }

    generate()
    {
        this._uml = new PlantUml(this._logger);
        this._processRegistry(this._registry);
        return this._uml;
    }

    _processRegistry(registry)
    {
        this._consumesQueue = [];
        this._publicClusterProvided = [];
        this._outputCloudHeader();
        for(var cluster of registry.clusters)
        {
            this._processCluster(cluster);
        }
        this._outputCloudFooter();
        for(var consumes of this._consumesQueue)
        {
            this._processEndpointsConsumesFooter(consumes);
        }
    }

    _processCluster(cluster)
    {
        this._outputClusterHeader(cluster);

        for(var sector of cluster.sectors)
        {
            this._processSector(sector);
        }

        for(var provided of _.values(cluster.provides))
        {
            this._processClusterProvided(provided);
        }

        this._outputClusterFooter(cluster);
    }

    _processSector(sector)
    {
        this._outputSectorHeader(sector);

        for(var db of sector.databases)
        {
            this._processDatabase(db);
        }

        for(var queue of sector.queues)
        {
            this._processQueue(queue);
        }

        for(var secret of sector.secrets)
        {
            this._processSecret(secret);
        }

        for(var lambda of sector.lambdas)
        {
            this._processLambda(lambda);
        }

        for(var service of sector.services)
        {
            this._processService(service);
        }

        this._outputSectorFooter(sector);
    }

    _processDatabase(db)
    {
        this._outputDatabaseHeader(db);
        this._outputDatabaseFooter(db);
    }

    _processQueue(queue)
    {
        this._outputQueueHeader(queue);
        this._outputQueueFooter(queue);
    }

    _processSecret(secret)
    {
        this._outputSecretHeader(secret);
        this._outputSecretFooter(secret);
    }

    _processLambda(lambda)
    {
        this._outputLambdaHeader(lambda);
        
        this._processConsumes(lambda)

        this._outputLambdaFooter(lambda);
    }

    _processService(service)
    {
        this._outputServiceHeader(service);

        for(var provided of _.values(service.provides))
        {
            this._processServiceProvided(provided);
        }

        this._processConsumes(service)

        for(var storage of service.storage)
        {
            this._processStorage(service, storage);
        }

        this._outputServiceFooter(service);
    }

    _processConsumes(item)
    {
        this._logger.verbose('[_processConsumes] source: %s', item.id);

        for(var consumed of item.consumes)
        {
            this._processEndpointsConsumes(consumed);
        }

        for(var consumed of item.databasesConsumes)
        {
            this._processDatabaseConsumes(consumed);
        }

        for(var consumed of item.queuesConsumes)
        {
            this._processQueueConsumes(consumed);
        }

        for(var consumed of item.secretsConsumes)
        {
            this._processServiceSecretConsumes(consumed);
        }
    }

    _processServiceProvided(provided)
    {
        this._outputServiceProvidedHeader(provided);
        this._outputServiceProvidedFooter(provided);
    }

    _processEndpointsConsumes(consumes)
    {
        this._consumesQueue.push(consumes);
        this._outputServiceEndpointsConsumesHeader(consumes);
    }

    _processEndpointsConsumesFooter(consumes)
    {
        this._outputServiceEndpointsConsumesFooter(consumes);
    }

    _processDatabaseConsumes(consumes)
    {
        this._outputDatabaseConsumesHeader(consumes);
    }

    _processDatabaseConsumesFooter(consumes)
    {
        this._outputDatabaseConsumesFooter(consumes);
    }

    _processQueueConsumes(consumes)
    {
        this._outputQueueConsumesHeader(consumes);
    }

    _processServiceSecretConsumes(consumes)
    {
        this._outputServiceSecretConsumesHeader(consumes);
    }

    _processClusterProvided(provided)
    {
        if (provided.definition.public) {
            this._publicClusterProvided.push(provided);
        }
        this._outputClusterProvidedHeader(provided);
        this._outputClusterProvidedFooter(provided);
    }

    _processStorage(service, storage)
    {
        this._outputStorage(service, storage);
    }

    _write(str)
    {
        this._uml.write(str);
    }

    /**************************************/
    _normalize(str)
    {
        return str.replace(/-/g, '_');
    }
    /**************************************/

    _outputCloudHeader()
    {
        this._write('cloud "Cloud: AWS" {');
    }

    _outputCloudFooter()
    {
        this._write('}');

        var externalConsumes = 'EX_Consumer';
        this._write('actor :Public User: as ' + externalConsumes);
        for(var clusterProvided of this._publicClusterProvided)
        {
            var clusterInterfaceName = this._getClusterProvidedInterfaceName(clusterProvided.cluster, clusterProvided.name);
            this._write(externalConsumes + ' --> ' + clusterInterfaceName + ' ' + this._publicToEndpointArrowColor);
            // this._write(externalConsumes + ' -> ' + clusterInterfaceName + ' #DarkRed')
        }
    }

    _outputSectorHeader(sector)
    {
        var sectorName = this._getSectorPackageName(sector);
        this._write('frame "Sector: ' + sector.name + '" as ' + sectorName + ' {');
    }

    _outputSectorFooter(sector)
    {
        this._write('}')
    }

    _outputClusterHeader(cluster)
    {
        var clusterPackageName = this._getClusterPackageName(cluster);
        this._write('node "Cluster: ' + cluster.name + '" as ' + clusterPackageName + ' {');
    }

    _outputClusterFooter(cluster)
    {
        this._write('}')
    }

    _outputDatabaseHeader(db)
    {
        var dbName = this._getDatabaseName(db);
        this._write('database ' + dbName + '[');
        this._write(db.kind);
        this._write('====');
        this._write(db.className + '::' + db.subClassName);
        this._write('====');
        this._write('**' + db.name + '**');
        this._write('====');
        if (db.hashKey) {
            this._write('<&key> ' + db.hashKey.name);
        }
        if (db.rangeKey) {
            this._write('....');
            this._write('<&list> ' + db.rangeKey.name);
        }
        this._write(']');
    }

    _outputDatabaseFooter(db)
    {

    }

    _outputQueueHeader(queue)
    {
        var queueName = this._getQueueName(queue);
        this._write('queue ' + queueName + '[');
        this._write(queue.kind);
        this._write('====');
        this._write(queue.className + '::' + queue.subClassName);
        this._write('====');
        this._write('**' + queue.name + '**');
        this._write(']');
    }

    _outputQueueFooter(queue)
    {

    }

    _outputSecretHeader(secret)
    {
        var secretName = this._getSecretName(secret);
        this._write('artifact ' + secretName + '[');
        this._write(secret.kind);
        this._write('====');
        this._write(secret.className + '::' + secret.subClassName);
        this._write('====');
        this._write('**' + secret.name + '**');
        this._write(']');
    }

    _outputSecretFooter(secret)
    {

    }

    _outputLambdaHeader(lambda)
    {
        var lambdaName = this._getLambdaName(lambda);
        this._write('folder ' + lambdaName + ' [');
        this._write('**' + lambda.name + '**');
        this._write('----');
        this._write('runtime: ' + lambda.runtime);
        this._write(']');
    }

    _outputLambdaFooter(lambda)
    {

    }

    _outputServiceHeader(service)
    {
        var servicePackageName = this._getServicePackageName(service);
        var color;
        if (service.isCompiled) {
            color = this._compiledServiceComponentBackground
        } else {
            color = this._serviceComponentBackground
        }

        this._write('package "Service: ' + service.name + '" as ' + servicePackageName + ' ' + color + ' {')

        if (this._renderServiceConsumerAgent) {
            var serviceConsumesName = this._getServiceConsumerAgentName(service);
            this._write('actor :Consumes: as ' + serviceConsumesName);
        }
    }

    _outputServiceFooter(service)
    {
        this._write('}')
    }

    _outputServiceProvidedHeader(provided)
    {
        var info = '';
        info += provided.name + '\\n';
        info += '===' + '\\n';
        info += 'Port: ' + provided.definition.port;
        info += '\\n' + provided.definition.protocol;

        var componentName = this._getProvidedComponentName(provided.service, provided.name);
        this._write('component "' + info + '" as ' + componentName);

        if (provided.loadBalance) {
            var interfaceInfo = provided.name;
            interfaceInfo += '-LoadBalancer <&wifi>';
            var interfaceName = this._getServiceProvidedInterfaceName(provided.service.clusterName, provided.service.name, provided.name);
            this._write('entity "' + interfaceInfo + '" as ' + interfaceName);
            this._write(componentName + ' .. ' + interfaceName + ' #RoyalBlue');
        }
    }

    _getServiceProvidedTarget(serviceId, providedName)
    {
        var service = this._registry.findById(serviceId);
        if (!service) {
            return 'MissingService';
        }
        var provided = service.provides[providedName];
        if (!provided) {
            return 'MissingEndpoint'
        }
        if (provided.loadBalance) {
            return this._getServiceProvidedInterfaceName(service.clusterName, service.name, providedName);
        } else {
            return this._getProvidedComponentName(service, providedName);
        }
    }

    _outputServiceProvidedFooter(provided)
    {
        if (this._renderServiceConsumerAgent) {
            var serviceConsumesName = this._getServiceConsumerAgentName(provided.service);
            var componentName = this._getProvidedComponentName(provided.service, provided.name);
            this._write(serviceConsumesName + ' -[hidden]-> ' + componentName);
        }
    }

    _outputClusterProvidedHeader(clusterProvided)
    {
        var interfaceName = this._getClusterProvidedInterfaceName(clusterProvided.cluster, clusterProvided.name);
        var serviceInterfaceName = this._getServiceProvidedTarget(clusterProvided.serviceId, clusterProvided.definition.endpointName);

        var color = '';
        if (clusterProvided.definition.public) {
            color = ' #red';
        }

        this._write('boundary "' + clusterProvided.name + '" as ' + interfaceName + color);
        this._write(serviceInterfaceName + ' .. ' + interfaceName + ' #RoyalBlue');
    }

    _outputClusterProvidedFooter(clusterProvided)
    {

    }

    _outputServiceEndpointsConsumesHeader(consumes)
    {

    }

    _outputServiceEndpointsConsumesFooter(consumes)
    {
        this._logger.verbose('[_outputServiceEndpointsConsumesFooter] source: %s', consumes.source.id);
        this._logger.verbose('[_outputServiceEndpointsConsumesFooter] consumed target: %s, endpoint: %s', consumes.targetId, consumes.definition.endpoint);
        var interfaceName;
        var color = '';
        if (consumes.targetKind == 'cluster') {
            interfaceName = this._getClusterProvidedInterfaceName(consumes.targetId, consumes.targetEndpoint);
            color = this._externalToEndpointArrowColor;
        } else {
            interfaceName = this._getServiceProvidedTarget(consumes.targetId, consumes.targetEndpoint);
            color = this._internalToEndpointArrowColor;
        }

        this._renderConsumesLine(consumes, '-->', interfaceName, color);
    }

    _outputDatabaseConsumesHeader(consumes)
    {
        this._logger.verbose('[_outputDatabaseConsumesHeader] %s', consumes.id);

        var databaseEntity = consumes.localTarget;
        if (!databaseEntity) {
            return;
        }
        var dbName = this._getDatabaseName(databaseEntity);

        this._logger.verbose('[_outputDatabaseConsumesHeader] source: %s', consumes.source.id);
        this._logger.verbose('[_outputDatabaseConsumesHeader] consumed database: %s', consumes.targetId);
        this._renderConsumesLine(consumes, '-->', dbName, this._internalToEndpointArrowColor);
    }

    _outputDatabaseConsumesFooter(consumes)
    {

    }

    _outputQueueConsumesHeader(consumes)
    {
        var queueEntity = consumes.localTarget;
        if (!queueEntity) {
            return;
        }
        var queueName = this._getQueueName(queueEntity);

        this._logger.verbose('[_outputQueueConsumesHeader] source: %s', consumes.source.id);
        this._logger.verbose('[_outputQueueConsumesHeader] consumed queue: %s', consumes.targetId);
        this._renderConsumesLine(consumes, '-->', queueName, this._internalToEndpointArrowColor);
    }

    _outputServiceSecretConsumesHeader(consumes)
    {
        this._logger.verbose('[_outputServiceSecretConsumesHeader] source: %s', consumes.source.id);

        var secretEntity = consumes.localTarget;
        if (!secretEntity) {
            return;
        }
        var secretName = this._getSecretName(secretEntity);

        this._logger.verbose('[_outputServiceSecretConsumesHeader] consumed secret: %s', consumes.targetId);

        var arrowKind = '-(0)-';
        var canEncrypt = _.includes(consumes.actions, 'encrypt');
        var canDecrypt = _.includes(consumes.actions, 'decrypt');
        if (canEncrypt && canDecrypt) {
            arrowKind = '<-(0)->';
        } else if (canEncrypt) {
            arrowKind = '-0)->';
        } else if (canDecrypt) {
            arrowKind = '<-(0-';
        } else {
            arrowKind = '--';
        }

        this._renderConsumesLine(consumes, arrowKind, secretName, this._toSecretArrowColor);
    }

    _renderConsumesLine(consumes, arrowKind, targetName, color)
    {
        var interfaceName;
        if (consumes.source.kind == "service") {
            if (this._renderServiceConsumerAgent) {
                interfaceName = this._getServiceConsumerAgentName(consumes.source);
            } else {
                interfaceName = this._getServicePackageName(consumes.source);
            }
        } else if (consumes.source.kind == "lambda"){
            interfaceName = this._getLambdaName(consumes.source);
        } else {
            return;
        }

        this._write(interfaceName + ' ' + arrowKind + ' ' + targetName + ' ' + color);
    }

    _outputStorage(service, storage)
    {
        var storageName = this._getStorageName(service, storage.path);
        this._write('database ' + storageName + '[');
        this._write(storage.path);
        this._write('....');
        this._write(storage.size);
        this._write(']');
    }

    /***************************************************************/


    _getDatabaseName(databaseEntity)
    {
        return this._getPackageName('DATABASE', databaseEntity);
    }

    _getQueueName(queueEntity)
    {
        return this._getPackageName('QUEUE', queueEntity);
    }

    _getSecretName(secretEntity)
    {
        return this._getPackageName('SECRET', secretEntity);
    }

    _getLambdaName(lambdaEntity)
    {
        return this._getPackageName('LAMBDA', lambdaEntity);
    }

    _getStorageName(service, storagePath)
    {
        return this._getPackageName('VOL', service, [storagePath.replace(/\//g, '_')]);
    }

    _getProvidedComponentName(service, endpointName)
    {
        return this._getPackageName('PROV', service, [endpointName]);
    }

    _getServicePackageName(service)
    {
        return this._getPackageName('SVC', service);
    }

    _getClusterPackageName(cluster)
    {
        return this._getPackageName('CL', cluster);
    }

    _getSectorPackageName(sector)
    {
        return this._getPackageName('SEC', sector);
    }

    _getServiceConsumerAgentName(service)
    {
        return this._getPackageName('SVCAGENT', service);
    }

    _getClusterProvidedInterfaceName(clusterOrId, endpointName)
    {
        return this._getPackageName('CI', clusterOrId, [endpointName]);
    }

    _getServiceProvidedInterfaceName(cluster, service, endpoint)
    {
        return 'I_' + this._normalize(cluster) + '_' + this._normalize(service)  + '_' + this._normalize(endpoint);
    }

    _getPackageName(category, itemOrId, extras)
    {
        var components = [category];
        var naming;
        var kind;
        if (itemOrId instanceof BaseItem) {
            kind = itemOrId.kind;
            naming = itemOrId.naming;
        } else if (_.isString(itemOrId)) {
            var info = BaseItem.breakID(itemOrId);
            kind = info.kind;
            naming = info.naming;
        }
        components.push(kind);
        components = _.concat(components, naming);
        if (extras) {
            components = _.concat(components, extras);
        }
        components = components.map(x => this._normalize(x));
        return components.join('_');
    }

}

module.exports = RegistryDiagramGenerator;
