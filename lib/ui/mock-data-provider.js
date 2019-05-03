var Path = require('path');
var Promise = require('the-promise');

class DataProvider {

    constructor() {

    }
    
    //getting all regions
    getRegions() {
        console.log("[DataProvider][getRegions] begin")
        return Promise.timeout(1)
            .then(() => {
                console.log("[DataProvider][getRegions] inside begin")
                return [
                    {
                        name: 'us-central1',
                        provider: 'gcp'
                    },
                    {
                        name: 'us-east1',
                        provider: 'gcp'
                    },
                    {
                        name: 'us-east4',
                        provider: 'gcp'
                    },
                    {
                        name: 'us-west1',
                        provider: 'gcp'
                    },
                    {
                        name: 'us-west2',
                        provider: 'gcp'
                    },
                    {
                        name: 'us-east-1',
                        provider: 'aws'
                    },
                    {
                        name: 'us-east-2',
                        provider: 'aws'
                    },
                    {
                        name: 'us-west-1',
                        provider: 'aws'
                    },
                    {
                        name: 'us-west-2',
                        provider: 'aws'
                    }
                ];
            });
    }

    //getting deployments for specific region
    getDeployments(region) {
        console.log('[DataProvider][getDeployments] for : %s begin', region);

        return Promise.timeout(1)
            .then(() => {
                console.log('[DataProvider][getDeployments] for : %s inside begin', region);

                return [
                    {
                        name: "prod"
                    },
                    {
                        name: "pprod"
                    },
                    {
                        name: "test"
                    },
                    {
                        name: "dev"
                    }
                ];
            });
    }

    //getting clusters per region per deployment
    getClusters(region, deployment) {
        console.log('[DataProvider][getClusters] for region: %s deployment: %s begin', region, deployment);

        return Promise.timeout(1)
            .then(() => {
                console.log('[DataProvider][getClusters] for region: %s deployment: %s inside begin', region, deployment);

                return [
                    {
                        name: "hello",
                        state: "deploy",
                        status: "inprogres",
                        actions: [{
                            name: 'build'
                        }, {
                            name: 'push'
                        }, {
                            name: 'undeploy',
                            confirm: true
                        }]
                    },
                    {
                        name: "addr",
                        state: "deploy",
                        status: "completed",
                        actions: [{
                            name: 'build'
                        }, {
                            name: 'push'
                        }, {
                            name: 'undeploy',
                            confirm: true
                        }]
                    },
                    {
                        name: "img",
                        state: "undeploy",
                        status: "error",
                        actions: [{
                            name: 'build'
                        }, {
                            name: 'push'
                        }, {
                            name: 'deploy'
                        }]
                    },
                    {
                        name: "addrf",
                        state: "undeploy",
                        status: "completed",
                        actions: [{
                            name: 'build'
                        }, {
                            name: 'push'
                        }, {
                            name: 'deploy'
                        }]
                    }
                ];
            });
    }

    //gets cluster per region per deployment per cluster name
    getCluster(params) {
        //params.region
        //params.deployment
        //params.cluster
        console.log("[DataProvider][getCluster] begin")
        return Promise.timeout(1)
            .then(() => {
                console.log("[DataProvider][getCluster] inside begin")
                if (params.cluster == 'hello') {
                    return {
                        name: params.cluster,
                        state: "deploy",
                        status: "processing",
                        actions: [{
                            name: 'build'
                        }, {
                            name: 'push'
                        }, {
                            name: 'deploy'
                        }]
                    };
                }
                return {
                    name: params.cluster,
                    state: "undeploy",
                    status: "completed",
                    actions: [{
                        name: 'build'
                    }, {
                        name: 'push'
                    }, {
                        name: 'deploy'
                    }]
                };
            });

    }

    //getting definitions per cluster
    getDefinitions(params) {
        console.log('[DataProvider][getDefinitions] : %s begin', params);

        return Promise.timeout(1)
            .then(() => {

                return  [
                    {
                      "name": "addr",
                      "kind": "cluster",
                      "provides": {
                        "web": {
                          "public": true,
                          "service": "web"
                        }
                      }
                    },
                    {
                      "name": "proc",
                      "cluster": "addr",
                      "code": {
                        "kind": "docker"
                      },
                      "sector": "main",
                      "kind": "service",
                      "consumes": [
                        {
                          "actions": [
                            "subscribe"
                          ],
                          "queue": "jobs"
                        },
                        {
                          "database": "book"
                        }
                      ]
                    },
                    {
                      "cluster": "addr",
                      "code": {
                        "kind": "docker"
                      },
                      "kind": "service",
                      "provides": {
                        "default": {
                          "port": 4000,
                          "protocol": "http"
                        }
                      },
                      "name": "app",
                      "sector": "main",
                      "consumes": [
                        {
                          "database": "book"
                        },
                        {
                          "actions": [
                            "publish"
                          ],
                          "queue": "jobs"
                        },
                        {
                          "cluster": "phone"
                        }
                      ]
                    },
                    {
                      "cluster": "addr",
                      "code": {
                        "kind": "docker"
                      },
                      "kind": "service",
                      "provides": {
                        "default": {
                          "port": 3000,
                          "protocol": "http"
                        }
                      },
                      "name": "web",
                      "sector": "main",
                      "consumes": [
                        {
                          "service": "app"
                        }
                      ]
                    },
                    {
                      "cluster": "addr",
                      "init": "init.sql",
                      "subClass": "sql",
                      "kind": "database",
                      "name": "book",
                      "class": "sql",
                      "sector": "main"
                    },
                    {
                      "name": "jobs",
                      "cluster": "addr",
                      "class": "queue",
                      "subClass": "pubsub",
                      "sector": "main",
                      "kind": "queue"
                    },
                    {
                      "name": "memory",
                      "config": {
                        "max": 150,
                        "min": 100
                      },
                      "sector": "main",
                      "kind": "policy",
                      "target": {
                        "cluster": "addr"
                      }
                    },
                    {
                      "name": "memory",
                      "config": {
                        "max": null,
                        "min": 150
                      },
                      "sector": "main",
                      "kind": "policy",
                      "target": {
                        "cluster": "addr",
                        "deployment": "gprod"
                      }
                    },
                    {
                      "name": "memory",
                      "config": {
                        "max": 300,
                        "min": 200
                      },
                      "sector": "main",
                      "kind": "policy",
                      "target": {
                        "cluster": "addr",
                        "service": "proc",
                        "deployment": "gprod"
                      }
                    },
                    {
                      "name": "scale",
                      "config": {
                        "max": 10,
                        "min": 1,
                        "metrics": {
                          "cpu": {
                            "targetAverage": 44
                          },
                          "current_connections": {
                            "targetAverage": 200
                          },
                          "memory": {
                            "targetAverage": "1G"
                          }
                        }
                      },
                      "sector": "main",
                      "kind": "policy",
                      "target": {
                        "cluster": "addr",
                        "service": "app",
                        "deployment": "gprod"
                      }
                    },
                    {
                      "name": "cpu",
                      "config": {
                        "max": 0.15,
                        "min": 0.1
                      },
                      "sector": "main",
                      "kind": "policy",
                      "target": {
                        "cluster": "addr"
                      }
                    },
                    {
                      "name": "cpu",
                      "config": {
                        "max": 0.2,
                        "min": 0.15
                      },
                      "sector": "main",
                      "kind": "policy",
                      "target": {
                        "cluster": "addr",
                        "deployment": "gprod"
                      }
                    },
                    {
                      "name": "cpu",
                      "config": {
                        "max": 0.25,
                        "min": 0.2
                      },
                      "sector": "main",
                      "kind": "policy",
                      "target": {
                        "cluster": "addr",
                        "service": "proc",
                        "deployment": "gprod"
                      }
                    }
                  ];
            });
    }

    //getting diagram per cluster
    getDiagram(params) {
        //params.region
        //params.deployment
        //params.cluster

        console.log("[DataProvider][getDiagram] begin")
        return Promise.timeout(1)
            .then(() => {
                console.log("[DataProvider][getDiagram] inside begin")

                var imgPath = Path.join(__dirname, 'static', 'diagrams', 'hello.png');
                return imgPath;
            });

    }

}


module.exports = DataProvider;