module.exports = {
    name: "ExtendGrafana",

    canRun: ({compiler, registry}) => {
        if (registry.services.length == 0) {
            return false;
        }
        var policy = registry.resolvePolicy('extend-grafana');
        return policy.value;
    },

    globalAction: ({compiler, registry}) => {
        var grafanaCfg = {
            kind: 'service',
            sector: 'main',
            cluster: 'sprt',
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

        compiler.markClusterImplicit(grafanaCfg.cluster);

        var grafanaId = compiler._addImpicit(grafanaCfg)

        if (compiler.findByNaming('service', [grafanaCfg.cluster, grafanaCfg.sector, 'prmts'])) {
            compiler.addConsumes(grafanaId, {
                service: 'prmts',
                endpoint: 'server' 
            });
        }

        compiler.addConsumes(grafanaId, {
            sector: 'main', // TODO : maybe not needed
            meta: true
        });

        compiler.addClusterProvided(grafanaCfg.cluster, "grafana", {
            service: 'grafana',
            sector: 'main',
            public: true
        })
    }
}