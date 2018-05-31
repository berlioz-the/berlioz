const Path = require('path');
const Promise = require('the-promise');
const _ = require('the-lodash');

const CommandExtractor = require('./tools/command-extractor');

class Extractor
{
    constructor(logger, acceptor)
    {
        this._logger = logger;
        this._acceptor = acceptor;
    }

    process()
    {
        var commandPaths = [ __dirname ];
        if (process.env.BELIOZ_CLI_SUPER_COMMANDS) {
            commandPaths.push(process.env.BELIOZ_CLI_SUPER_COMMANDS);
        }
        return Promise.serial(commandPaths, x => this._extractCommandsFrom(x))
            .then(res => _.flatten(res));
    }

    _extractCommandsFrom(rootPath)
    {
        var commandsPath = Path.resolve(rootPath, 'commands');
        return CommandExtractor(this._logger, commandsPath, this._acceptCommand.bind(this));
    }

    _acceptCommand(command)
    {
        if (this._acceptor) {
            this._acceptor(command);
        }
    }
}

module.exports = Extractor;
