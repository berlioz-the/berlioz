
module.exports = {

    useClient: true,

    arguments: [
        'region'
    ],

    exec: function({args, client, screen}) {
        return client.get(args.region, '/clusters')
            .then(result => {
                screen.table(['Name', 'Latest Version'])
                    .addRange(result, x => [x.name, x.latestVersion])
                    .output();
            });
    }

}
