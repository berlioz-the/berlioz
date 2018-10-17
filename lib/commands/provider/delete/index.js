module.exports = {

    useClient: true,

    arguments: [
        {
            name: 'name',
            autocomplete_target: 'provider'
        }
    ],

    exec: function({args, client}) {
        return client.deleteMaster('/provider/' + args.name);
    }

}
