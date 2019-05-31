module.exports = {
    name: "ExtendGcpSqlStorage",

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