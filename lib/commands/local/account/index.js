var prompt = require('prompt');

module.exports = {

    arguments: [
        'profile'
    ],

    exec: function({Promise, _, args, logger, screen, config}) {
        config.set('config', 'local-aws-profile', args.profile);
    }

}
