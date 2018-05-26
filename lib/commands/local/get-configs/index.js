var prompt = require('prompt');

module.exports = {

    exec: function({Promise, _, args, logger, screen, config}) {
        var configs = config.getAll('config');
        screen.table(['Property', 'Value'])
            .addRange(_.keys(configs), x => [x, configs[x]])
            .output();
    }
}
