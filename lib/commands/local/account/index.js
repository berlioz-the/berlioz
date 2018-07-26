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
        config.set('config', 'local-aws-profile', args.profile);
        if (args.region) {
            config.set('config', 'local-aws-region', args.region);
        }
        screen.info('Will use AWS profile \"%s\" for local deployment', args.profile);
    }

}
