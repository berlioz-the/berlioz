module.exports = {

    arguments: [
        {
            name: 'name',
            autocomplete_target: 'deployment'
        }
    ],

    exec: function({args, client}) {
        return client.delete('/deployment/' + args.name);
    }

}
