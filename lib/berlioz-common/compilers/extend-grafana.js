module.exports = {
    name: "ExtendGrafana",

    canRun: (cluster) => {
        var policy = cluster.resolvePolicy('extend-grafana');
        return policy.value;
    },

    clusterAction: (compiler, cluster) => {
        var grafanaId = compiler._addImpicit({
            kind: 'service',
            sector: 'infra',
            cluster: cluster.name,
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
        })

        if (compiler._findByNaming('service', [cluster.name, 'infra', 'prometheus'])) {
            compiler._addConsumes(grafanaId, {
                service: 'prometheus',
                endpoint: 'server' 
            });
        }

        compiler._addConsumes(grafanaId, {
            sector: 'main',
            meta: true
        });
        compiler._addConsumes(grafanaId, {
            sector: 'infra',
            meta: true
        });

        compiler._addClusterProvided(cluster.id, "grafana", {
            service: 'grafana',
            sector: 'infra',
            public: true
        })
    }
}