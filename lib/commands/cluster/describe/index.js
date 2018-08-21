
module.exports = {

    arguments: [
        {
            name: 'name',
            autocomplete_target: 'cluster'
        },
        {
            name: 'version',
            optional: true
        }
    ],

    exec: function({args, client, screen, parseDefinitions}) {
        var url = '/cluster/describe/' + args.name;
        if (args.version) {
            url += '?version=' + args.version;
        }
        return client.get(url)
            .then(result => {
                if (!result) {
                    screen.error('Cluster \'%s\' not found.', args.name);
                    return;
                }
                screen.info('Cluster: %s', result.name);
                screen.info('Version: %s', result.date);

                return parseDefinitions(result.definition)
                    .then(registry => {
                        for (var obj of registry.clusters) {
                            screen.outputCluster(obj);
                        }
                        for (var obj of registry.images) {
                            screen.header('IMAGE');
                            screen.outputEntity(obj);
                        }
                    });
            });
    }
}
