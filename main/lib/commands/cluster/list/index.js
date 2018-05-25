
module.exports = {

    arguments: [
    ],

    exec: function({args, client, screen}) {
        return client.get('/clusters')
            .then(result => {
                screen.table(['Name', 'Latest Version'])
                    .addRange(result, x => [x.name, x.latestVersion])
                    .output();
            });
    }

}
