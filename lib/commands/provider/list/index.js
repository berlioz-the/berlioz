module.exports = {

    useClient: true,

    arguments: [
    ],

    exec: function({args, client, screen}) {
        return client.getMaster('/provider')
            .then(result => {
                screen.table(['Name', 'Kind', 'Key'])
                    .addRange(result, x => [x.name, x.kind, x.key])
                    .output();
            });
    }

}
