var fs = require('fs');

module.exports = {

    useClient: true,

    arguments: [
        'name',
        'key-path'
    ],

    exec: function({args, client, screen, inputError}) {
        var data = {
            name: args.name,
            kind: 'gcp'
        };

        if (!fs.existsSync(args['key-path'])) {
            inputError('Key file ' + args['key-path'] + ' does not exist.');
        }

        var contents = fs.readFileSync(args['key-path'], 'utf8');
        data.credentials = JSON.parse(contents);

        return client.postMaster('/provider', data)
            .then(result => {
                screen.info('Provider linked.');
            });
    }

}
