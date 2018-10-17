module.exports = {

    useClient: true,

    arguments: [
        'name',
        {
            name: 'kind',
            autocomplete_target: 'provider_kind'
        },
        'key',
        'secret'
    ],

    exec: function({args, client, screen}) {
        var data = {
            name: args.name,
            kind: args.kind,
            key: args.key,
            secret: args.secret
        };

        return client.postMaster('/provider', data)
            .then(result => {
                screen.info('Provider linked.');
            });
    }

}
