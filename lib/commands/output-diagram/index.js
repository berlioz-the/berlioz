const RegistryDiagramGenerator = require('../../tools/registry-diagram-generator');
const _ = require('the-lodash');

module.exports = {

    useProject: true,
    useRegistryCompiler: true,

    arguments: [
    ],

    flags: [
        'save',
        'compile'
    ],

    exec: function({args, registry, compiler, screen, logger, rootDir}) {
        if (args.compile) {
            registry = compiler.process(registry);
        }
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
    }
}
