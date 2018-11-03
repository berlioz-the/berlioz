module.exports = {
    name: "ExtendZipkin",

    canRun: (cluster) => {
        var policy = cluster.resolvePolicy('distributed-tracing-provider');
        if (policy.value == 'zipkin' || policy.value == 'jaeger') {
            return true;
        }
        return false;
    },

    clusterAction: (compiler, cluster) => {
        var policy = cluster.resolvePolicy('distributed-tracing-provider');

        var dtraceCfg = {
            kind: 'service',
            cluster: cluster.name,
            sector: 'infra',
            name: 'dtrace',
            code: {
                kind: 'docker',
                image: ''
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
            },
            environment: {

            }
        }

        if (policy.value == 'zipkin') {
            dtraceCfg.code.image = 'openzipkin/zipkin';
        } else if (policy.value == 'jaeger') {
            dtraceCfg.code.image = 'jaegertracing/all-in-one';
            dtraceCfg.environment["COLLECTOR_ZIPKIN_HTTP_PORT"] = "9411";
            dtraceCfg.provides["web"] = {
                port: 16686,
                protocol: 'http'
            }
        }

        var dtraceSvcId = compiler._addImpicit(dtraceCfg);
        
        if (policy.value == 'zipkin') {
            compiler._addClusterProvided(cluster.id, "dtrace", {
                sector: 'infra',
                service: 'dtrace',
                endpoint: 'client',
                public: true
            })
        } else if (policy.value == 'jaeger') {
            compiler._addClusterProvided(cluster.id, "dtrace", {
                sector: 'infra',
                service: 'dtrace',
                endpoint: 'web',
                public: true
            })
        }


        for(var service of cluster.services)
        {
            if (service.id == dtraceSvcId) {
                continue;
            }
            if (service.isImplicit) {
                continue;
            }

            compiler._logger.info('[_extendZipkin] %s...', service.id);

            compiler._addConsumes(service.id, {
                service: 'dtrace',
                sector: 'infra',
                endpoint: 'client'
            });
        }
    }
}