module.exports = {
    name: "ExtendZipkin",

    canRun: (cluster) => {
        var policy = cluster.resolvePolicy('extend-zipkin');
        return policy.value;
    },

    clusterAction: (compiler, cluster) => {
        var zipkinId = compiler._addImpicit({
            kind: 'service',
            cluster: cluster.name,
            sector: 'infra',
            name: 'zipkin',
            code: {
                kind: 'docker',
                image: 'openzipkin/zipkin'
            },
            provides: {
                client: {
                    port: 9411,
                    protocol: 'http'
                }
            },
            resources: {
                memory: {
                    min: 300
                }
            }
        });
        compiler._addClusterProvided(cluster.id, "zipkin", {
            service: 'zipkin',
            sector: 'infra',
            endpoint: 'client',
            public: true
        })

        for(var service of cluster.services)
        {
            if (service.id == zipkinId) {
                continue;
            }
            if (service.isImplicit) {
                continue;
            }

            compiler._logger.info('[_extendZipkin] %s...', service.id);

            compiler._addConsumes(service.id, {
                service: 'zipkin',
                sector: 'infra',
                endpoint: 'client'
            });
        }
    }
}