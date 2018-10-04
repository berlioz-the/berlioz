const RegistryDiagramGenerator = require('../../tools/registry-diagram-generator');
const _ = require('the-lodash');

module.exports = {

    useProject: true,

    arguments: [
        {
            name: 'deployment',
            optional: true
        },
        {
            name: 'region',
            optional: true
        }
    ],


    flags: [
        'save',
        'compile'
    ],

    exec: function({args, registry, screen, logger, rootDir}) {

        return Promise.resolve()
            .then(() => {
                if (args.compile) {
                    var policyTarget = {
                        deployment: args['deployment'],
                        region: args['region']
                    }
                    return Promise.resolve(registry.scopePolicies(policyTarget))
                        .then(registry => registry.compile(logger))
                } else {
                    return registry;
                }
            })
            .then(registry => {
                var generator = new RegistryDiagramGenerator(logger, registry);
                var plantuml = generator.generate();
                if (args['save']) {
                    return plantuml.renderToImage(rootDir)
                        .then(diagramPath => {
                            screen.info('Diagram saved to: %s', diagramPath);
                        });
                } else {
                    return plantuml.renderToTempImage()
                        .then(diagramPath => {
                            screen.info('Diagram rendered to: %s. Openning in browser...', diagramPath);
                        });
                }
            })
    }
}
