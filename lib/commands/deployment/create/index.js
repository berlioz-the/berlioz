module.exports = {

    useClient: true,

    arguments: [
        'name',
        {
            name: 'provider',
            autocomplete_target: 'provider'
        }
    ],

    exec: function({args, client, screen}) {
        var data = {
            name: args.name,
            provider: args.provider
        };

        return client.postMaster('/deployment', data)
            .then(result => {
                screen.info('Deployment %s created.', result.name);
            });
    }

}
