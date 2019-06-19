module.exports = {

    useProject: true,

    exec: function({registry, logger, screen, docker, config, args}) {
        screen.info('Definitions are valid.');

        var tableData = [];
        for(var cluster of registry.clusters)
        {
            tableData.push([cluster.id, cluster.berliozfile]);
            for(var service of cluster.services)
            {
                tableData.push([service.id, service.berliozfile]);
            }
            for(var database of cluster.databases)
            {
                tableData.push([database.id, database.berliozfile]);
            }
            for(var queue of cluster.queues)
            {
                tableData.push([queue.id, queue.berliozfile]);
            }
        }

        screen.table()
            .autofitColumn('Definition')
            .column('Location')
            .addRange(tableData)
            .output();
    }

}
