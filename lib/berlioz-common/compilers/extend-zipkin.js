const BaseItem = require('../entities/base')

module.exports = {
    name: "ExtendZipkin",

    canRun: ({compiler, registry}) => {
        if (registry.services.length == 0) {
            return false;
        }
        var policy = registry.resolvePolicy('distributed-tracing-provider');
        if (policy.value == 'zipkin' || policy.value == 'jaeger') {
            return true;
        }
        return false;
    },

    globalAction: ({compiler, registry}) => {
        var policy = registry.resolvePolicy('distributed-tracing-provider');

        var dtraceCfg = {
            kind: 'service',
            cluster: 'sprt',
            sector: 'main',
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

        compiler.markClusterImplicit(dtraceCfg.cluster);

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
            compiler.addClusterProvided(dtraceCfg.cluster, "dtrace", {
                sector: dtraceCfg.sector,
                service: dtraceCfg.name,
                endpoint: 'client',
                public: true
            });
            compiler.addClusterProvided(dtraceCfg.cluster, "dtracerep", {
                sector: dtraceCfg.sector,
                service: dtraceCfg.name,
                endpoint: 'client'
            });
        } else if (policy.value == 'jaeger') {
            compiler.addClusterProvided(dtraceCfg.cluster, "dtrace", {
                sector: dtraceCfg.sector,
                service: dtraceCfg.name,
                endpoint: 'web',
                public: true
            })
            compiler.addClusterProvided(dtraceCfg.cluster, "dtracerep", {
                sector: dtraceCfg.sector,
                service: dtraceCfg.name,
                endpoint: 'client'
            })
        }


        for(var service of registry.services)
        {
            if (service.isCompiled) {
                continue
            }
            if (service.isImplicit) {
                continue;
            }
            compiler.addConsumes(service.id, {
                cluster: dtraceCfg.cluster,
                endpoint: 'dtracerep'
            });
        }
    }
}