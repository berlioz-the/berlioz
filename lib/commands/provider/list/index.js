module.exports = {

    arguments: [
    ],

    exec: function({args, client, screen}) {
        return client.get('/provider')
            .then(result => {
                screen.table(['Name', 'Kind', 'Key'])
                    .addRange(result, x => [x.name, x.kind, x.key])
                    .output();
            });
    }

}
