const Publisher = require('../../tools/publisher')
const Builder = require('../../tools/builder')

module.exports = {

    useProject: true,

    arguments: [
        {
            name: 'cluster',
            optional: true
        },
        {
            name: 'image',
            optional: true
        }
    ],

    flags: [
        'skip-build'
    ],

    exec: function({args, registry, client, logger, screen, Promise, docker, config}) {
        var publisher = new Publisher(logger, registry, config, client);
        if (args.cluster) {
            publisher.setTargetCluster(args.cluster);
        }
        if (args.image) {
            publisher.setTargetImage(args.image);
        }

        return Promise.resolve()
            .then(() => {
                if (args['skip-build']) {
                    return;
                }
                var builder = new Builder(logger, registry, config, docker, screen);
                return builder.perform();
            })
            .then(() => {
                return publisher.perform();
            });
    }

}
