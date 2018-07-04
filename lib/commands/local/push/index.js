const Builder = require('../../../tools/builder')

module.exports = {

    useProject: true,
    useLocalDeployer: true,

    arguments: [
    ],

    flags: [
        'skip-build'
    ],

    exec: function({args, registry, logger, screen, Promise, localDeployer, docker}) {

        return Promise.resolve()
            .then(() => {
                if (args['skip-build']) {
                    return;
                }
                var builder = new Builder(logger, registry, docker, screen);
                return builder.perform();
            })
            .then(() => {
                return localDeployer.pushImages(registry);
            });
    }

}
