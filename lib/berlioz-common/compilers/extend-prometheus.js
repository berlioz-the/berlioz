module.exports = {
    name: "ExtendPrometheus",

    canRun: ({compiler, registry, logger}) => {
        // return true;
        logger.info("[ExtendPrometheus] clusters: ", registry.clusters.map(x => x.id));
        logger.info("[ExtendPrometheus] services: ", registry.services.map(x => x.id));

        if (registry.services.length == 0)
        {
            if (!registry.findByNaming('cluster', ['sprt'])) 
            {
                return false;
            }
        }
        var policy = registry.resolvePolicy('extend-prometheus');
        return policy.value;
    },

    globalAction: ({compiler, registry}) => {
        var prometheusCfg = {
            kind: 'service',
            sector: 'main',
            cluster: 'sprt',
            name: 'prmts',
            code: {
                kind: 'docker',
                image: 'berliozcloud/prometheus'
            },
            provides: {
                server: {
                    port: 9090,
                    protocol: 'http'
                },
                push: {
                    port: 9091,
                    protocol: 'http'
                }
            },
            resources: {
                memory: {
                    min: 400
                }
            }
        }
        
        compiler.markClusterImplicit(prometheusCfg.cluster);

        var prometheusId = compiler._addImpicit(prometheusCfg)

        compiler.addConsumes(prometheusId, {
            cluster: 'berlioz',
            endpoint: 'agent_mon'
        });
    }

}