module.exports = {
    name: "ExtendPrometheus",

    canRun: (cluster) => {
        var policy = cluster.resolvePolicy('extend-prometheus');
        return policy.value;
    },

    clusterAction: (compiler, cluster) => {
        var prometheusId = compiler._addImpicit({
            kind: 'service',
            sector: 'infra',
            cluster: cluster.name,
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
        })

        compiler._addConsumes(prometheusId, {
            service: 'berlioz_agent',
            sector: 'infra',
            endpoint: 'mon'
        });
    }

}