
module.exports = {

    useClient: true,

    arguments: [
    ],

    exec: function({args, client, screen}) {
        return client.getMaster('/deployment')
            .then(result => {
                screen.table(['Name', 'Provider'])
                    .addRange(result, x => [x.name, x.provider])
                    .output();
            });
    }

}
