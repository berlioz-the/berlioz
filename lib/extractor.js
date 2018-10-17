const Path = require('path');
const fs = require('fs');
const Promise = require('the-promise');
const _ = require('the-lodash');

const CommandExtractor = require('./tools/command-extractor');

class Extractor
{
    constructor(logger, config, acceptor)
    {
        this._logger = logger;
        this._config = config;
        this._acceptor = acceptor;
    }

    process()
    {
        var commandPaths = [ __dirname ];
        if (process.env.BELIOZ_CLI_SUPER_COMMANDS) {
            commandPaths.push(process.env.BELIOZ_CLI_SUPER_COMMANDS);
        }
        return Promise.resolve()
        .then(() => Promise.serial(commandPaths, x => this._extractCommandsFrom(x)))
        .then(res => _.flatten(res));
    }

    _extractCommandsFrom(rootPath)
    {
        return Promise.resolve()
            .then(() => {
                var initFile = Path.join(rootPath, 'init.js');
                if (fs.existsSync(initFile)) {
                    var initModule = require(initFile);
                    return initModule(this._logger, this._config);
                }
            })
            .then(() => {
                var commandsPath = Path.resolve(rootPath, 'commands');
                return CommandExtractor(this._logger, commandsPath, this._acceptCommand.bind(this));
            })
    }

    _acceptCommand(command)
    {
        if (this._acceptor) {
            this._acceptor(command);
        }
    }
}

module.exports = Extractor;
