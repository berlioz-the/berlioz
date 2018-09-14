const _ = require('the-lodash');

module.exports = {

    useProject: true,
    useRegistryCompiler: true,

    arguments: [
    ],

    flags: [
        'compile'
    ],

    exec: function({args, registry, compiler, screen, logger}) {
        if (args.compile) {
            registry = compiler.process(registry);
        }
        for (var obj of registry.clusters) {
            screen.outputCluster(obj);
        }
        for (var obj of registry.images) {
            screen.header('IMAGE');
            screen.outputEntity(obj);
        }
        for (var obj of registry.policies) {
            screen.outputEntity(obj);
        }
    }
}
