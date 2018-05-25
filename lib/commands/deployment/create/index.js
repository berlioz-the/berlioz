module.exports = {

    arguments: [
        'name',
        {
            name: 'provider',
            autocomplete_target: 'provider'
        },
        {
            name: 'region',
            autocomplete_target: 'all_regions'
        }
    ],

    exec: function({args, client, screen}) {
        var data = {
            name: args.name,
            provider: args.provider,
            regions: [
                args.region
            ]
        };

        return client.post('/deployment', data)
            .then(result => {
                screen.write('Deployment ' + result.name + ' created.');
            });
    }

}
