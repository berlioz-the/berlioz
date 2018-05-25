
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
                    screen.write('Cluster not found.');
                    return;
                }
                screen.write('Cluster: ' + result.name);
                screen.write('Version: ' + result.date);

                return parseDefinitions(result.definition)
                    .then(registry => {
                        for (var obj of registry.clusters()) {
                            screen.outputCluster(obj);
                        }
                        for (var obj of registry.images()) {
                            screen.write('*************** IMAGE **************');
                            screen.outputEntity(obj);
                        }
                    });
            });
    }
}
