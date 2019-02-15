module.exports = {

    useClient: true,

    arguments: [
        'name',
        'key',
        'secret'
    ],

    exec: function({args, client, screen}) {
        var data = {
            name: args.name,
            kind: 'aws',
            key: args.key,
            secret: args.secret
        };

        return client.postMaster('/provider', data)
            .then(result => {
                screen.info('Provider linked.');
            });
    }

}
