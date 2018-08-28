const Path = require('path');
const _ = require('the-lodash');
const Promise = require('the-promise');
const Registry = require('./registry');
const Parser = require('./parser');
const Loader = require('./loader')
const BaseItem = require('../berlioz-common/entities/base')

class Compiler
{
    constructor(logger)
    {
        this._logger = logger;
        require('./logger').logger = logger;
        this._parser = new Parser(logger);
        this._loader = new Loader(logger);

        this._stages = [
            {
                name: "ExtendPrometheus",
                action: this._extendPrometheus.bind(this)
            },
            // {
            //     name: "ExtendGrafana",
            //     action: this._extendGrafana.bind(this)
            // },
            {
                name: "ExtendZipkin",
                action: this._extendZipkin.bind(this)
            },
            {
                name: "ExtendBerliozAgent",
                action: this._extendAgents.bind(this)
            }
        ]
    }

    get loader() {
        return this._loader;
    }

    process(registry)
    {
        this._registry = registry;

        for(var stage of this._stages) {
            this._logger.info('[Compiler::process] %s...', stage.name)
            this._processStage(stage.name, stage.action);
        }

        return this._registry;
    }

    _extendPrometheus(registry)
    {
        for(var cluster of registry.clusters)
        {
            var prometheusId = this._addImpicit({
                kind: 'service',
                sector: 'infra',
                cluster: cluster.name,
                name: 'prometheus',
                code: {
                    kind: 'docker',
                    image: 'prom/prometheus'
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

            this._addConsumes(prometheusId, {
                service: 'berlioz_agent',
                sector: 'main',
                endpoint: 'mon'
            });
        }
    }

    _extendGrafana(registry)
    {
        for(var cluster of registry.clusters)
        {
            this._addImpicit({
                kind: 'service',
                sector: 'infra',
                cluster: cluster.name,
                name: 'grafana',
                code: {
                    kind: 'docker',
                    image: 'grafana/grafana'
                },
                provides: {
                    web: {
                        port: 3000,
                        protocol: 'http'
                    }
                },
                consumes: [{
                    service: 'prometheus',
                    endpoint: 'server' 
                }],
                resources: {
                    memory: {
                        min: 250
                    }
                }
            })
        }
    }

    _extendZipkin(registry)
    {
        for(var cluster of registry.clusters)
        {
            var zipkinId = this._addImpicit({
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
            this._addClusterProvided(cluster.id, "zipkin", {
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
                this._logger.info('[_extendZipkin] %s...', service.id);

                this._addConsumes(service.id, {
                    service: 'zipkin',
                    sector: 'infra',
                    endpoint: 'client'
                });
            }
            
        }
    }

    _extendAgents(registry)
    {
        for(var cluster of registry.clusters)
        {
            this._logger.info('[_extendAgents] %s...', cluster.id);
            for(var service of cluster.services)
            {
                this._logger.info('[_extendAgents] %s...', service.id);

                this._setupBerliozAgentForService(service);

                this._addConsumes(service.id, {
                    service: 'berlioz_agent',
                    sector: service.sectorName,
                    endpoint: 'ws',
                    isolation: 'instance'
                });
            }
        }
    }

    _setupBerliozAgentForService(service)
    {
        var agentServiceId = BaseItem.constructID('service', [service.clusterName, service.sectorName, 'berlioz_agent']);
        if (agentServiceId in this._items) {
            return;
        }

        agentServiceId = this._addImpicit({
            kind: 'service',
            sector: service.sectorName,
            cluster: service.clusterName,
            name: 'berlioz_agent',
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

        this._addImpicit({
            kind: 'queue',
            sector: service.sectorName,
            cluster: service.clusterName,
            name: 'berlioz_agent',
            class: 'queue',
            subClass: 'sqs',
            pairWithConsumer: true
        })

        this._addConsumes(agentServiceId, {
            queue: 'berlioz_agent'
        });
    }


    _processStage(name, action)
    {
        this._items = {};
        for (var item of this._registry.allItems)
        {
            if (item.isImplicit) {
                continue;
            }
            this._items[item.id] = {
                berliozfile:  item._berliozfile,
                isCompiled: item.isCompiled,
                definition: _.clone(item.definition),
            }
        }

        action(this._registry);
        return this._produceRegistry();
    }

    _produceRegistry()
    {
        this._registry = new Registry();
        for (var itemInfo of _.values(this._items))
        {
            var obj = this._parser.parseDefinition(itemInfo.definition);
            if (obj) {
                if (itemInfo.berliozfile) {
                    obj.setPath(itemInfo.berliozfile);
                }
                if (itemInfo.isCompiled) {
                    obj._isCompiled = true;
                }
                obj.addToRegistry(this._registry);
            }
        }
        this._loader.postProcess(this._registry);
    }

    _addImpicit(definition)
    {
        var obj = this._parser.parseDefinition(definition);
        if (obj) {
            this._items[obj.id] = {
                isCompiled: true,
                definition: definition
            }
            return obj.id;
        } else {
            throw new Error('Error constructing compiled definition.');
        }
    }

    _get(id)
    {
        return this._items[id];
    }

    _addConsumes(id, consumed)
    {
        var info = this._get(id);
        if (!info.definition.consumes) {
            info.definition.consumes = []
        }
        info.definition.consumes.push(consumed);
    }
    
    _addClusterProvided(id, name, provided)
    {
        var info = this._get(id);
        if (!info.definition.provides) {
            info.definition.provides = []
        }
        info.definition.provides[name] = provided;
    }


}

module.exports = Compiler;
