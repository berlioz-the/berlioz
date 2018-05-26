const RegistryDiagramGenerator = require('../../tools/registry-diagram-generator');
const _ = require('the-lodash');

module.exports = {

    useProject: true,

    arguments: [
    ],

    flags: [
        'save'
    ],

    exec: function({args, registry, screen, logger, rootDir}) {
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
