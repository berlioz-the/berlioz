const BaseItem = require('../entities/base')

module.exports = {
    name: "ExtendK8sController",

    canRun: (compiler, registry) => {
        if (compiler.policyTarget.providerKind == 'gcp' || 
            compiler.policyTarget.providerKind == 'k8s') 
        {
            return true;
        }
        return false;
    },

    globalAction: (compiler, registry) => {
        if (registry.clusters.length == 0) {
            return;
        }

        var controllerInfo = {
            cluster: 'berlioz',
            sector: 'main',
            name: 'berlioz_controller'
        }

        compiler._markClusterImplicit(controllerInfo.cluster);

        var controllerServiceId = BaseItem.constructID('service', [
            controllerInfo.cluster, 
            controllerInfo.sector, 
            controllerInfo.name]);
        if (controllerServiceId in compiler._items) {
            return controllerInfo;
        }

        controllerServiceId = compiler._addImpicit({
            kind: 'service',
            sector: controllerInfo.sector,
            cluster: controllerInfo.cluster,
            name: controllerInfo.name,
            code: {
                kind: 'docker',
                image: 'berliozcloud/k8s-controller'
            },
            resources: {
                memory: {
                    min: 100
                }
            },
            environment: {
            },
            nativeConfig: {
                imagePullPolicy: 'Always',
                serviceAccountName: 'sa-berlioz-controller'
            }
        })

        compiler._addConsumes(controllerServiceId, {
            service: 'berlioz_agent',
            endpoint: 'ws'
        });

        return controllerInfo;
    }
}