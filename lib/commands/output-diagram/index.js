const RegistryDiagramGenerator = require('../../tools/registry-diagram-generator');
const _ = require('the-lodash');

module.exports = {

    useProject: true,

    arguments: [
        {
            name: 'type',
            optional: true
        },
        {
            name: 'deployment',
            optional: true
        },
        {
            name: 'region',
            optional: true
        },
        {
            name: 'provider',
            optional: true
        },
        {
            name: 'providerKind',
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
                        region: args['region'],
                        provider: args['provider'],
                        providerKind: args['providerKind']
                    }
                    return Promise.resolve(registry.scopePolicies(policyTarget))
                        .then(registry => registry.compile(logger, policyTarget))
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
                    return plantuml.renderToTempImage(args.type)
                        .then(diagramPath => {
                            screen.info('Diagram rendered to: %s. Openning in browser...', diagramPath);
                        });
                }
            })
    }
}
