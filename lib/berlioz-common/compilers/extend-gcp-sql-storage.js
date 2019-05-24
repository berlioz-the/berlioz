module.exports = {
    name: "ExtendGcpSqlStorage",

    canRun: ({compiler, registry}) => {
        var policy = registry.resolvePolicy('extend-grafana');
        return policy.value;
    },

    globalAction: ({compiler, registry}) => {

        for(var database of registry.databases)
        {   
            if (database.hasInitScript)
            {
                var storageCfg = {
                    kind: 'database',
                    sector: 'init',
                    cluster: database.clusterName,
                    name: database.name,
                    class: 'storage',
                    subClass: 'storage',
                }
                var storageId = compiler._addImpicit(storageCfg)

                compiler.addConsumes(database.id, {
                    database: storageCfg.name,
                    sector: storageCfg.sector
                });
            }
        }
    }
}