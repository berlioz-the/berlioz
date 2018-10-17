module.exports = {
    
    useClient: true,

    arguments: [
        {
            name: 'name',
            autocomplete_target: 'deployment'
        }
    ],

    exec: function({args, client}) {
        return client.deleteMaster('/deployment/' + args.name);
    }

}
