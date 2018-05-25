module.exports = {

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

        return client.post('/provider', data)
            .then(result => {
                screen.write('Provider linked.');
            });
    }

}
