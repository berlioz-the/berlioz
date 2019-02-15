module.exports = {
    name: "ExtendPrometheus",

    canRun: (compiler, registry) => {
        var policy = registry.resolvePolicy('extend-prometheus');
        return policy.value;
    },

    globalAction: (compiler, registry) => {
        var prometheusCfg = {
            kind: 'service',
            sector: 'main',
            cluster: 'support',
            name: 'prometheus',
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
        
        compiler._markClusterImplicit(prometheusCfg.cluster);

        var prometheusId = compiler._addImpicit(prometheusCfg)

        compiler._addConsumes(prometheusId, {
            cluster: 'berlioz',
            endpoint: 'agent_mon'
        });
    }

}