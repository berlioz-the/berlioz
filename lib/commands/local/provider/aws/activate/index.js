module.exports = {

    arguments: [
    ],

    exec: function({Promise, _, args, logger, screen, config, inputError}) {
        
        var provider = config.get('config', ['local-provider', 'aws']);
        if (!provider) {
            inputError('AWS local provider not configured. Use \"berlioz local provider aws set\"');
        }

        config.set('config', 'active-local-provider', 'aws');
        screen.info('Will use AWS profile \"%s\" for local deployment', provider.profile);
    }

}
