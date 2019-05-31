const BaseItem = require('../entities/base')

module.exports = {
    name: "ExtendAgent",

    canRun: ({compiler, registry}) => {
        if (registry.clusters.length == 0) {
            return false;
        }

        if (registry.services.length == 0)
        {
            if (!registry.findByNaming('cluster', ['berlioz'])) 
            {
                return false;
            }
        }

        return true;
    },

    globalAction: ({compiler, registry}) => {
        var agentInfo = _setupBerliozAgent();

        for(var service of registry.services)
        {
            compiler.addConsumes(service.id, {
                cluster: agentInfo.cluster,
                endpoint: 'agent_ws',
                isolation: 'instance'
            });
        }

        function _setupBerliozAgent()
        {
            var agentInfo = {
                cluster: 'berlioz',
                sector: 'main',
                name: 'agent'
            }

            compiler.markClusterImplicit(agentInfo.cluster);
            var clusterItem = compiler.fetchCluster(agentInfo.cluster);
            clusterItem.definition.sidecar = "compute";

            var agentServiceId = BaseItem.constructID('service', [
                agentInfo.cluster, 
                agentInfo.sector, 
                agentInfo.name]);
            if (compiler.hasItem(agentServiceId)) {
                return agentInfo;
            }

            agentServiceId = compiler._addImpicit({
                kind: 'service',
                sector: agentInfo.sector,
                cluster: agentInfo.cluster,
                name: agentInfo.name,
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
            
            compiler.addClusterProvided(agentInfo.cluster, "agent_ws", {
                service: agentInfo.name,
                sector: agentInfo.sector,
                endpoint: 'ws'
            })

            compiler.addClusterProvided(agentInfo.cluster, "agent_mon", {
                service: agentInfo.name,
                sector: agentInfo.sector,
                endpoint: 'mon'
            })
            

            if (compiler.policyTarget.providerKind == 'aws') {
                compiler._addImpicit({
                    kind: 'queue',
                    sector: agentInfo.sector,
                    cluster: agentInfo.cluster,
                    name: 'agent',
                    class: 'queue',
                    subClass: 'sqs',
                    pairWithConsumer: true
                })
    
                compiler.addConsumes(agentServiceId, {
                    queue: 'agent'
                });
            }

            return agentInfo;
        }
    }
}