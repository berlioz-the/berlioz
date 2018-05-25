module.exports = {

    arguments: [
        {
            name: 'name',
            autocomplete_target: 'provider'
        }
    ],

    exec: function({args, client}) {
        return client.delete('/provider/' + args.name);
    }

}
