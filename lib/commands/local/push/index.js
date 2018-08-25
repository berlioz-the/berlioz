const Builder = require('../../../tools/builder')

module.exports = {

    useProject: true,
    useDocker: true,
    useLocalDeployer: true,

    arguments: [
    ],

    flags: [
        'nocache',
        'skip-build'
    ],

    exec: function({args, registry, logger, screen, Promise, docker, config}) {

        return Promise.resolve()
            .then(() => {
                if (args['skip-build']) {
                    return;
                }
                var builder = new Builder(logger, registry, config, docker, screen);
                builder.setNoCache(args['nocache']);
                return builder.perform();
            });
    }

}
