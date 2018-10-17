const BaseItem = require('../entities/base')

module.exports = {
    name: "ExtendFinalizePrometheus",

    canRun: (cluster) => {
        var policy = cluster.resolvePolicy('extend-prometheus');
        return policy.value;
    },

    clusterAction: (compiler, cluster) => {
        var prometheusId = BaseItem.constructID('service', [cluster.name, 'infra', 'prometheus']);
        if (compiler._findById(prometheusId))
        {
            for(var sector of cluster.sectors)
            {
                var agentServiceId = BaseItem.constructID('service', [sector.clusterName, sector.name, 'berlioz_agent']);
                if (compiler._findById(agentServiceId))
                {
                    compiler._addConsumes(prometheusId, {
                        sector: sector.name,
                        service: 'berlioz_agent',
                        endpoint: 'mon'
                    });
                }
            }
        }
    }
}