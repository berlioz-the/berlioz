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

    //gets cluster per region per deployment
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