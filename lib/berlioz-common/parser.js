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
        var fileContents = YAML.load(path);
        var definitions;
        if (_.isArray(fileContents)) 
        {
            definitions = fileContents;
        } 
        else 
        {
            definitions = [fileContents];
        }
        var parsedObjects = [];
        for(var definition of definitions)
        {
            var parsedObj = this.parseDefinition(definition);
            if (parsedObj) {
                parsedObj.setPath(path);
                parsedObjects.push(parsedObj);
            }
        }
        return parsedObjects;
    }

    parseDefinition(definition)
    {
        if ('enabled' in definition) {
            if (!definition.enabled) {
                this._logger.debug('Disabled. Skipping.');
                return null;
            }
        }
        if ('enable' in definition) {
            if (!definition.enable) {
                this._logger.debug('Disabled. Skipping.');
                return null;
            }
        }

        var ObjType = require('./entities/' + definition.kind);
        var parsedObj = new ObjType(definition);
        if (parsedObj) {
            this._logger.silly('Definition loaded.', definition);
        } else {
            this._logger.error('Definition has errors: ', definition);
        }

        return parsedObj;
    }

}

module.exports = Parser;
