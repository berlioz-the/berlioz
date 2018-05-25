
module.exports = {

    arguments: [
    ],

    exec: function({args, client, screen}) {
        return client.get('/deployment')
            .then(result => {
                screen.table(['Name', 'Provider', 'Regions'])
                    .addRange(result, x => [x.name, x.provider, x.regions])
                    .output();
            });
    }

}
