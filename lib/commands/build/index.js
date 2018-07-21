const Builder = require('../../tools/builder')

module.exports = {

    useProject: true,

    arguments: [
    ],

    exec: function({registry, logger, screen, docker, config}) {
        var builder = new Builder(logger, registry, config, docker, screen);
        return builder.perform();
    }

}
