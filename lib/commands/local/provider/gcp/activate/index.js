module.exports = {

    arguments: [
    ],

    exec: function({Promise, _, args, logger, screen, config, inputError}) {
        
        var provider = config.get('config', ['local-provider', 'gcp']);
        if (!provider) {
            inputError('GCP local provider not configured. Use \"berlioz local provider gcp set\"');
        }

        config.set('config', 'active-local-provider', 'gcp');
        screen.info('Will use GCP project \"%s\" for local deployment', provider.projectId);
    }

}
