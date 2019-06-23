var fs = require('fs');

module.exports = {

    arguments: [
        'key-path',
        {
            name: 'region',
            optional: true
        }
    ],

    exec: function({Promise, _, args, logger, screen, config, inputError}) {
        
        if (!fs.existsSync(args['key-path'])) {
            inputError('Key file ' + args['key-path'] + ' does not exist.');
        }

        var contents = fs.readFileSync(args['key-path'], 'utf8');
        var credentials = JSON.parse(contents);

        var provider = {
            credentials: credentials,
            projectId: credentials.project_id
        }

        if (args.region) {
            provider.region = args.region;
        }

        config.set('config', ['local-provider', 'gcp'], provider);
        config.set('config', 'active-local-provider', 'gcp');
        screen.info('Will use GCP project \"%s\" for local deployment', provider.projectId);
    }

}
