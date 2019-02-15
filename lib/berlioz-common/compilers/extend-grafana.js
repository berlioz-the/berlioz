module.exports = {
    name: "ExtendGrafana",

    canRun: (compiler, registry) => {
        var policy = registry.resolvePolicy('extend-grafana');
        return policy.value;
    },

    globalAction: (compiler, registry) => {
        var grafanaCfg = {
            kind: 'service',
            sector: 'main',
            cluster: 'support',
            name: 'grafana',
            code: {
                kind: 'docker',
                image: 'berliozcloud/grafana'
            },
            provides: {
                default: {
                    port: 3000,
                    protocol: 'http'
                }
            },
            resources: {
                memory: {
                    min: 250
                }
            }
        }

        compiler._markClusterImplicit(grafanaCfg.cluster);

        var grafanaId = compiler._addImpicit(grafanaCfg)

        if (compiler._findByNaming('service', [grafanaCfg.cluster, grafanaCfg.sector, 'prometheus'])) {
            compiler._addConsumes(grafanaId, {
                service: 'prometheus',
                endpoint: 'server' 
            });
        }

        compiler._addConsumes(grafanaId, {
            sector: 'main', // TODO : maybe not needed
            meta: true
        });

        compiler._addClusterProvided(grafanaCfg.cluster, "grafana", {
            service: 'grafana',
            sector: 'main',
            public: true
        })
    }
}