const Builder = require('../../tools/builder')

module.exports = {

    useProject: true,
    useDocker: true,

    arguments: [
        {
            name: 'tmp-build-dir',
            optional: true
        }
    ],

    flags: [
        'nocache'
    ],

    exec: function({registry, logger, screen, docker, config, args}) {
        var builder = new Builder(logger, registry, config, docker, screen);
        builder.setNoCache(args['nocache']);
        builder.setTmpDir(args['tmp-build-dir']);
        return builder.perform();
    }

}
