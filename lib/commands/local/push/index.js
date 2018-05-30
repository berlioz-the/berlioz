const Builder = require('../../../tools/builder')

module.exports = {

    useProject: true,
    useLocalDeployer: true,

    arguments: [
    ],

    flags: [
        'skip-build'
    ],

    exec: function({args, registry, logger, screen, Promise, localDeployer}) {

        return Promise.resolve()
            .then(() => {
                if (args['skip-build']) {
                    return;
                }
                var builder = new Builder(logger, registry, screen);
                return builder.perform();
            })
            .then(() => {
                return localDeployer.pushImages(registry);
            });
    }

}
