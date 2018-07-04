const Builder = require('../../tools/builder')

module.exports = {

    useProject: true,

    arguments: [
    ],

    exec: function({registry, logger, screen, docker}) {
        var builder = new Builder(logger, registry, docker, screen);
        return builder.perform();
    }

}
