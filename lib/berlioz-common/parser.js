const YAML = require('yamljs');
const _ = require('the-lodash');

class Parser
{
    constructor(logger)
    {
        this._logger = logger;
        require('./logger').logger = logger;
    }

    parse(path)
    {
        this._logger.debug('Loading %s ...', path);
        var definition = YAML.load(path);
        var parsedObj = this.parseDefinition(definition);
        if (parsedObj) {
            parsedObj.setPath(path);
        }
        return parsedObj;
    }

    parseDefinition(definition)
    {
        if ('enabled' in definition) {
            if (!definition.enabled) {
                this._logger.debug('Disabled. Skipping.');
                return null;
            }
        }

        var ObjType = require('./entities/' + definition.kind);
        var parsedObj = new ObjType(definition);

        this._logger.debug('Definition loaded.');
        return parsedObj;
    }

}

module.exports = Parser;
