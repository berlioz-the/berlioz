module.exports = {

    arguments: [
    ],

    exec: function({Promise, _, args, logger, screen, config, inputError}) {
        
        config.set('config', 'active-local-provider', 'aws');
        // screen.info('Will use AWS profile \"%s\" for local deployment', args.profile);
    }

}
