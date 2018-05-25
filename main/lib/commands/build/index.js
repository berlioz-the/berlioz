const Builder = require('../../tools/builder')

module.exports = {

    useProject: true,

    arguments: [
    ],

    exec: function({registry, logger}) {
        var builder = new Builder(logger, registry);
        return builder.perform();
    }

}
