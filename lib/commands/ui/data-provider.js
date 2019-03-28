const Path = require('path');
const Promise = require('the-promise');
const _ = require('the-lodash');
const RegistryDiagramGenerator = require('../../tools/registry-diagram-generator');

class DataProvider {

    constructor(logger, vorpal, client, parseDefinitions) {
        this._logger = logger;
        this._vorpal = vorpal;
        this._client = client;
        this._parseDefinitions = parseDefinitions;
    }

    get logger() {
        return this._logger;
    }
    
    getRegions() {
        return this._client.getRegions();
    }

    getDeployments(region) {
        return this._runCommand(['deployment', 'list'])
    }

    getClusters(region, deployment) {
        var args = {
            region: region,
            deployment: deployment
        }
        return this._runCommand(['status'], args)
            .then(results => results.map(x => this._setupActions(x)))
    }

    getCluster(params) {
        return this._runCommand(['status'], params)
            .then(results => {
                if (results.length == 0) {
                    return null;
                }
                return _.head(results);
            })
            .then(result => this._setupActions(result));
    }

    _setupActions(cluster)
    {
        if (!cluster) {
            return null;
        }
        cluster.name = cluster.cluster;
        cluster.actions = [];
        cluster.actions.push({
            name: 'build'
        })
        cluster.actions.push({
            name: 'push'
        })
        if (cluster.state == 'deploy') {
            cluster.actions.push({
                name: 'undeploy',
                confirm: true
            })
        } else {
            cluster.actions.push({
                name: 'deploy'
            })
        }
        this.logger.info("CLUSTER: ", cluster)
        return cluster;
    }

    getDefinitions(params) {
        var params = _.clone(params);
        params.versionKind = 'latest';
        return this._runCommand(['deployment', 'cluster', 'definitions'], params);
    }

    getDiagram(params) {
        var params = _.clone(params);
        params.versionKind = 'latest';
        this.logger.info('[getDiagram] begin')
        return this._runCommand(['deployment', 'cluster', 'definitions'], params)
            .then(definitions => {
                if (!definitions) {
                    return null;
                }
                this.logger.info('[getDiagram] definitions: ', definitions);
                return this._parseDefinitions(definitions)
                    .then(registry => {
                        this.logger.info('[getDiagram] parsed... ');
                        var generator = new RegistryDiagramGenerator(this.logger, registry);
                        var plantuml = generator.generate();
                        return plantuml.render('svg')
                            .then(diagramPath => {
                                this.logger.info('[getDiagram] generated to %s', diagramPath);
                                return diagramPath;
                            });
                        });
            });
    }

    _runCommand(command, args)
    {
        this.logger.info("Running command %s, args: ", command, args);
        return this._vorpal.execUI(command, args)
            .then(result => {
                this.logger.info("Command %s result: ", command, result);
                // console.log('****************')
                // console.log(result)
                return result;
            })
            .catch(reason => {
                this.logger.error("Command %s error: ", command, reason);
            })
            ;
    }

}


module.exports = DataProvider;