const PlantUml = require('./plantuml');
const _ = require('the-lodash');

class RegistryDiagramGenerator
{
    constructor(logger, registry)
    {
        this._logger = logger;
        this._registry = registry;
        this._renderServiceConsumerAgent = true;
        this._serviceComponentBackground = '#LightBlue';
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
        for(var cluster of registry.clusters())
        {
            this._processCluster(cluster);
        }
        this._outputCloudFooter();
        for(var consumes of this._consumesQueue)
        {
            this._processServiceEndpointsConsumesFooter(consumes);
        }
    }

    _processCluster(cluster)
    {
        this._outputClusterHeader(cluster);

        for(var db of cluster.databases)
        {
            this._processDatabase(db);
        }

        for(var queue of cluster.queues)
        {
            this._processQueue(queue);
        }

        for(var secret of cluster.secrets)
        {
            this._processSecret(secret);
        }

        for(var service of cluster.services)
        {
            this._processService(service);
        }

        for(var provided of _.values(cluster.provides))
        {
            this._processClusterProvided(provided);
        }

        this._outputClusterFooter(cluster);
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

    _processService(service)
    {
        this._outputServiceHeader(service);

        for(var provided of _.values(service.provides))
        {
            this._processServiceProvided(provided);
        }

        for(var consumed of service.consumes)
        {
            this._processServiceEndpointsConsumes(consumed);
        }

        for(var consumed of service.databasesConsumes)
        {
            this._processServiceDatabaseConsumes(consumed);
        }

        for(var consumed of service.queuesConsumes)
        {
            this._processServiceQueueConsumes(consumed);
        }

        for(var consumed of service.secretsConsumes)
        {
            this._processServiceSecretConsumes(consumed);
        }

        for(var storage of service.storage)
        {
            this._processStorage(service, storage);
        }

        this._outputServiceFooter(service);
    }

    _processServiceProvided(provided)
    {
        this._outputServiceProvidedHeader(provided);
        this._outputServiceProvidedFooter(provided);
    }

    _processServiceEndpointsConsumes(consumes)
    {
        this._consumesQueue.push(consumes);
        this._outputServiceEndpointsConsumesHeader(consumes);
    }

    _processServiceEndpointsConsumesFooter(consumes)
    {
        this._outputServiceEndpointsConsumesFooter(consumes);
    }

    _processServiceDatabaseConsumes(consumes)
    {
        this._outputServiceDatabaseConsumesHeader(consumes);
    }

    _processServiceDatabaseConsumesFooter(consumes)
    {
        this._outputServiceDatabaseConsumesFooter(consumes);
    }

    _processServiceQueueConsumes(consumes)
    {
        this._outputServiceQueueConsumesHeader(consumes);
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
            var clusterInterfaceName = this._getClusterProvidedInterfaceName(clusterProvided.cluster.name, clusterProvided.name);
            this._write(externalConsumes + ' --> ' + clusterInterfaceName + ' ' + this._publicToEndpointArrowColor);
            // this._write(externalConsumes + ' -> ' + clusterInterfaceName + ' #DarkRed')
        }
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

    _outputSecretFooter(queue)
    {

    }

    _outputServiceHeader(service)
    {
        var servicePackageName = this._getServicePackageName(service);
        this._write('package "Service: ' + service.name + '" as ' + servicePackageName + ' ' + this._serviceComponentBackground + ' {')

        if (this._renderServiceConsumerAgent) {
            var serviceConsumesName = this._getServiceConsumerAgentName(service.clusterName, service.name);
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

        var componentName = this._getProvidedComponentName(provided.service.clusterName, provided.service.name, provided.name);
        this._write('component "' + info + '" as ' + componentName);

        if (provided.loadBalance) {
            var interfaceInfo = provided.name;
            interfaceInfo += '-LoadBalancer <&wifi>';
            var interfaceName = this._getServiceProvidedInterfaceName(provided.service.clusterName, provided.service.name, provided.name);
            this._write('entity "' + interfaceInfo + '" as ' + interfaceName);
            this._write(componentName + ' .. ' + interfaceName + ' #RoyalBlue');
        }
    }

    _getServiceProvidedTarget(clusterName, serviceName, providedName)
    {
        var cluster = this._registry.getCluster(clusterName);
        var service = cluster.getServiceByName(serviceName);
        if (!service) {
            return 'MissingService' + clusterName + serviceName;
        }
        var provided = service.provides[providedName];
        if (provided.loadBalance) {
            return this._getServiceProvidedInterfaceName(clusterName, serviceName, providedName);
        } else {
            return this._getProvidedComponentName(clusterName, serviceName, providedName);
        }
    }

    _outputServiceProvidedFooter(provided)
    {
        if (this._renderServiceConsumerAgent) {
            var serviceConsumesName = this._getServiceConsumerAgentName(provided.service.clusterName, provided.service.name);
            var componentName = this._getProvidedComponentName(provided.service.clusterName, provided.service.name, provided.name);
            this._write(serviceConsumesName + ' -[hidden]-> ' + componentName);
        }
    }

    _outputClusterProvidedHeader(clusterProvided)
    {
        var interfaceName = this._getClusterProvidedInterfaceName(clusterProvided.cluster.name, clusterProvided.name);
        var serviceInterfaceName = this._getServiceProvidedTarget(clusterProvided.cluster.name, clusterProvided.definition.serviceName, clusterProvided.definition.endpointName);

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
        this._logger.verbose('[_outputServiceEndpointsConsumesFooter] cluster: %s, service: %s', consumes.service.clusterName, consumes.service.name);
        this._logger.verbose('[_outputServiceEndpointsConsumesFooter] consumed target: %s, endpoint: %s', consumes.targetId, consumes.definition.endpoint);
        var interfaceName;
        var color = '';
        if (consumes.targetKind == 'cluster') {
            interfaceName = this._getClusterProvidedInterfaceName(consumes.targetNaming[0], consumes.targetEndpoint);
            color = this._externalToEndpointArrowColor;
        } else {
            interfaceName = this._getServiceProvidedTarget(consumes.targetNaming[0], consumes.targetNaming[1], consumes.targetEndpoint);
            color = this._internalToEndpointArrowColor;
        }

        if (this._renderServiceConsumerAgent) {
            var serviceConsumesName = this._getServiceConsumerAgentName(consumes.service.clusterName, consumes.service.name);
            this._write(serviceConsumesName + ' --> ' + interfaceName + ' ' + color);
        } else {
            var servicePackageName = this._getServicePackageName(consumes.service);
            this._write(servicePackageName + ' --> ' + interfaceName + ' ' + color);
        }
    }

    _outputServiceDatabaseConsumesHeader(consumes)
    {
        var databaseEntity = consumes.localTarget;
        if (!databaseEntity) {
            return;
        }
        var dbName = this._getDatabaseName(databaseEntity);

        this._logger.verbose('[_outputServiceDatabaseConsumesHeader] cluster: %s, service: %s', consumes.service.clusterName, consumes.service.name);
        this._logger.verbose('[_outputServiceDatabaseConsumesHeader] consumed database: %s', consumes.targetId);
        var color = this._internalToEndpointArrowColor;

        if (this._renderServiceConsumerAgent) {
            var serviceConsumesName = this._getServiceConsumerAgentName(consumes.service.clusterName, consumes.service.name);
            this._write(serviceConsumesName + ' --> ' + dbName + ' ' + color);
        } else {
            var servicePackageName = this._getServicePackageName(consumes.service);
            this._write(servicePackageName + ' --> ' + dbName + ' ' + color);
        }
    }

    _outputServiceDatabaseConsumesFooter(consumes)
    {

    }

    _outputServiceQueueConsumesHeader(consumes)
    {
        var queueEntity = consumes.localTarget;
        if (!queueEntity) {
            return;
        }
        var queueName = this._getQueueName(queueEntity);

        this._logger.verbose('[_outputServiceQueueConsumesHeader] cluster: %s, service: %s', consumes.service.clusterName, consumes.service.name);
        this._logger.verbose('[_outputServiceQueueConsumesHeader] consumed queue: %s', consumes.targetId);
        var color = this._internalToEndpointArrowColor;

        if (this._renderServiceConsumerAgent) {
            var serviceConsumesName = this._getServiceConsumerAgentName(consumes.service.clusterName, consumes.service.name);
            this._write(serviceConsumesName + ' --> ' + queueName + ' ' + color);
        } else {
            var servicePackageName = this._getServicePackageName(consumes.service);
            this._write(servicePackageName + ' --> ' + queueName + ' ' + color);
        }
    }

    _outputServiceSecretConsumesHeader(consumes)
    {
        this._logger.verbose('[_outputServiceSecretConsumesHeader] INIT cluster: %s, service: %s', consumes.service.clusterName, consumes.service.name);

        var secretEntity = consumes.localTarget;
        if (!secretEntity) {
            return;
        }
        var secretName = this._getSecretName(secretEntity);

        this._logger.verbose('[_outputServiceSecretConsumesHeader] cluster: %s, service: %s', consumes.service.clusterName, consumes.service.name);
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

        if (this._renderServiceConsumerAgent) {
            var serviceConsumesName = this._getServiceConsumerAgentName(consumes.service.clusterName, consumes.service.name);
            this._write(serviceConsumesName + ' ' + arrowKind + ' ' + secretName + ' ' + this._toSecretArrowColor);
        } else {
            var servicePackageName = this._getServicePackageName(consumes.service);
            this._write(servicePackageName + ' ' + arrowKind + ' ' + secretName + ' ' + this._toSecretArrowColor);
        }
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
        return 'DB_' + this._normalize(databaseEntity.clusterName) + '_' + this._normalize(databaseEntity.name);
    }

    _getQueueName(queueEntity)
    {
        return 'Q_' + this._normalize(queueEntity.clusterName) + '_' + this._normalize(queueEntity.name);
    }

    _getSecretName(secretEntity)
    {
        return 'S_' + this._normalize(secretEntity.clusterName) + '_' + this._normalize(secretEntity.name);
    }

    _getStorageName(serviceEntity, storagePath)
    {
        return 'VOL_' + this._normalize(serviceEntity.clusterName) + '_' + this._normalize(serviceEntity.name) + '_' + this._normalize(storagePath.replace(/\//g, '_'));
    }

    _getProvidedComponentName(cluster, service, endpoint)
    {
        return 'C_' + this._normalize(cluster) + '_' + this._normalize(service) + '_' + this._normalize(endpoint);
    }

    _getServicePackageName(service)
    {
        return 'S_' + this._normalize(service.clusterName) + '_' + this._normalize(service.name);
    }

    _getClusterPackageName(cluster)
    {
        return 'CL_' + this._normalize(cluster.name);
    }

    _getServiceConsumerAgentName(cluster, service)
    {
        return 'CO_' + this._normalize(cluster) + '_' + this._normalize(service);
    }

    _getClusterProvidedInterfaceName(cluster, endpoint)
    {
        return 'CI_' + this._normalize(cluster) + '_' + this._normalize(endpoint);
    }

    _getServiceProvidedInterfaceName(cluster, service, endpoint)
    {
        return 'I_' + this._normalize(cluster) + '_' + this._normalize(service)  + '_' + this._normalize(endpoint);
    }

}

module.exports = RegistryDiagramGenerator;
