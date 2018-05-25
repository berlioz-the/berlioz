
module.exports = {

    arguments: [
        {
            name: 'name',
            autocomplete_target: 'cluster'
        }
    ],

    exec: function({args, client, screen}) {
        return client.get('/cluster/versions/' + args.name)
            .then(result => {
                screen.table(['Version'])
                    .addRange(result, x => [x.date])
                    .output();
            });
    }

}
