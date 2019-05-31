const BaseItem = require('../entities/base')

module.exports = {
    name: "ExtendK8sController",

    canRun: ({compiler, registry}) => {
        if (registry.clusters.length == 0) {
            return false;
        }

        if (compiler.policyTarget.providerKind == 'gcp' || 
            compiler.policyTarget.providerKind == 'k8s') 
        {
            if (registry.services.length > 0) {
                return true;
            } else {
                for(var cluster of registry.clusters)
                {
                    if (cluster.name == 'berlioz')
                    {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    globalAction: ({compiler, registry}) => {
        var controllerInfo = {
            cluster: 'berlioz',
            sector: 'main',
            name: 'ctlr'
        }

        compiler.markClusterImplicit(controllerInfo.cluster);

        var controllerServiceId = BaseItem.constructID('service', [
            controllerInfo.cluster, 
            controllerInfo.sector, 
            controllerInfo.name]);
        if (compiler.hasItem(controllerServiceId)) {
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
                imagePullPolicy: 'Always'
            }
        })

        compiler.addConsumes(controllerServiceId, {
            service: 'agent',
            endpoint: 'ws'
        });

        return controllerInfo;
    }
}