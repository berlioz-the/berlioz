var prompt = require('prompt');

module.exports = {

    arguments: [
        'profile',
        {
            name: 'region',
            optional: true
        }
    ],

    exec: function({Promise, _, args, logger, screen, config}) {
        var provider = {
            profile: args.profile
        }
        if (args.region) {
            provider.region = args.region;
        }
        if (args.region) {
            config.set('config', 'local-aws-region', args.region);
        }
        config.set('config', ['local-provider', 'aws'], provider);
        screen.info('Will use AWS profile \"%s\" for local deployment', args.profile);
    }

}
