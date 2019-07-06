module.exports = {

    useClient: true,

    arguments: [
    ],

    exec: function({args, dataProvider, screen}) {
        return dataProvider.getProviders()
            .then(result => {
                screen.table(['Name', 'Kind', 'Key'])
                    .addRange(result, x => [x.name, x.kind, x.key])
                    .output();
            });
    }

}
