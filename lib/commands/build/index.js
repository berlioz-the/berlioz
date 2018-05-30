const Builder = require('../../tools/builder')

module.exports = {

    useProject: true,

    arguments: [
    ],

    exec: function({registry, logger, screen}) {
        var builder = new Builder(logger, registry, screen);
        return builder.perform();
    }

}
