const _ = require('the-lodash');

module.exports = {

    useProject: true,

    arguments: [
    ],

    exec: function({args, registry, screen, logger}) {
        for (var obj of registry.clusters()) {
            screen.outputCluster(obj);
        }
        for (var obj of registry.images()) {
            screen.write('*************** IMAGE **************');
            screen.outputEntity(obj);
        }
    }
}
