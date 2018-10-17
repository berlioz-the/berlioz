const BaseItem = require('../entities/base')

module.exports = {
    name: "ExtendAgent",

    clusterAction: (compiler, cluster) => {
        compiler._logger.info('[_extendAgents] %s...', cluster.id);
        for(var service of cluster.services)
        {
            compiler._logger.info('[_extendAgents] %s...', service.id);

            _setupBerliozAgentForService(service);

            compiler._addConsumes(service.id, {
                service: 'berlioz_agent',
                sector: service.sectorName,
                endpoint: 'ws',
                isolation: 'instance'
            });
        }


        function _setupBerliozAgentForService(service)
        {
            var agentServiceId = BaseItem.constructID('service', [service.clusterName, service.sectorName, 'berlioz_agent']);
            if (agentServiceId in compiler._items) {
                return;
            }

            agentServiceId = compiler._addImpicit({
                kind: 'service',
                sector: service.sectorName,
                cluster: service.clusterName,
                name: 'berlioz_agent',
                sidecar: 'instance',
                code: {
                    kind: 'docker',
                    image: 'berliozcloud/agent'
                },
                provides: {
                    ws: {
                        port: 55555,
                        protocol: 'http'
                    },
                    mon: {
                        port: 55556,
                        protocol: 'http'
                    }
                },
                storage: [{
                    kind: 'bind',
                    path: '/var/run/docker.sock',
                    source: '/var/run/docker.sock'
                }],
                resources: {
                    memory: {
                        min: 100
                    }
                },
                environment: {
                }
            })

            compiler._addImpicit({
                kind: 'queue',
                sector: service.sectorName,
                cluster: service.clusterName,
                name: 'berlioz_agent',
                class: 'queue',
                subClass: 'sqs',
                pairWithConsumer: true
            })

            compiler._addConsumes(agentServiceId, {
                queue: 'berlioz_agent'
            });
        }
    }
}