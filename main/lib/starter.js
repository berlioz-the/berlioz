const Path = require('path');
const Promise = require('the-promise');
const _ = require('the-lodash');

const Loader = require('./berlioz-common/loader');

const ConfigRegistry = require('./tools/config-registry');
const BerliozClient = require('./tools/berlioz-client');
const VorpalInterface = require('./tools/vorpal-interface');
const CommandExtractor = require('./tools/command-extractor');
const Screen = require('./tools/screen');
const LocalDeployer = require('./tools/local-deployer');
const Docker = require('./tools/docker');

const Autocomplete = require('./autocomplete');

class Starter
{
    constructor(logger, rootDir)
    {
        this._logger = logger;
        this._rootDir = rootDir;
        this._commands = [];

        this._configRegistry = new ConfigRegistry(this._logger.sublogger('ConfigRegistry'));
        this._client = new BerliozClient(this._logger.sublogger('Client'), this._configRegistry);
        this._autocomplete = new Autocomplete(this._logger, this._client);
        this._interface = new VorpalInterface(this._logger,
                                              this._executeCommand.bind(this),
                                              this._autocompleteProcessor.bind(this));
    }

    run(commandStr)
    {
        return Promise.resolve()
            .then(() => this._extractCommands())
            .then(() => {
                if (commandStr.length == 0) {
                    return this._interface.interactive();
                } else {
                    return this._interface.exec(commandStr);
                }
            })
            ;
    }

    _extractCommands()
    {
        var commandPaths = [ __dirname ];
        if (process.env.BELIOZ_CLI_SUPER_COMMANDS) {
            commandPaths.push(process.env.BELIOZ_CLI_SUPER_COMMANDS);
        }
        return Promise.serial(commandPaths, x => this._extractCommandsFrom(x));
    }

    _extractCommandsFrom(rootPath)
    {
        var commandsPath = Path.resolve(rootPath, 'commands');
        return CommandExtractor(this._logger, commandsPath)
            .then(commands => this._acceptCommands(commands));
    }

    _acceptCommands(commands)
    {
        for(var command of commands)
        {
            this._acceptCommand(command);
        }
    }

    _acceptCommand(command)
    {
        try {
            this._interface.accept(command);
            this._commands.push(command);
        } catch (e) {
            this._logger.error('Failed accepting command.');
            this._logger.exception(e);
        }
    }

    _triggerInteractiveShell()
    {
        this._logger.verbose('Triggering interactive shell...');
        this._interface.interactive();
    }

    _executeCommand(info, commandModule, args, callback)
    {
        this._logger.verbose('Running command: %s...', info.command);
        this._logger.verbose('ARGS: ', args);
        try {
            var commandParams = {
                host: this,
                rootDir: this._rootDir,
                args: args.options,
                config: this._configRegistry,
                client: this._client,
                logger: this._logger,
                screen: new Screen(),
                parseDefinitions: this.parseDefinitions.bind(this),
                Promise: Promise,
                _: _
            };

            commandModule.docker = new Docker(this._logger.sublogger('Docker'));

            if (commandModule.useLocalDeployer)
            {
                commandParams.localDeployer = new LocalDeployer(this._logger.sublogger('LocalDeployer'), this._configRegistry, commandModule.docker);
            }

            if (commandModule.useDevTools)
            {
                const DevTools = require('./tools/dev-tools');
                commandParams.devTools = new DevTools(this._logger, this._rootDir);
            }

            return Promise.resolve()
                .then(() => this._configRegistry.loadData())
                .then(() => {
                    if (commandModule.useProject)
                    {
                        return this._loadDefinitions()
                            .then(registry => {
                                commandParams.registry = registry
                            });
                    }
                })
                .then(() => {
                    this._logger.verbose('Launching command %s...', info.command);
                })
                .then(() => commandModule.exec(commandParams))
                .then(() => {
                    this._logger.verbose('Saving config data...');
                })
                .then(() => this._configRegistry.saveData())
                .then(() => {
                    this._logger.verbose('Config data saved.');
                })
                .then(result => {
                    callback();
                })
                .catch(error => {
                    this._logger.error('Error running command %s.', info.command);
                    this._logger.exception(error);
                });

        } catch(error) {
            this._logger.error('Error running command %s.', info.command);
            this._logger.exception(error);
        }
    }

    _autocompleteProcessor(name)
    {
        return this._autocomplete.create(name);
    }

    _loadDefinitions()
    {
        var loader = new Loader(this._logger)
        var registry = null;
        return Promise.resolve()
            .then(() => loader.fromDir(this._rootDir))
            .then(result => {
                this._logger.verbose('Definitions Loaded.');
                registry = result;
                this._logger.silly('Registry loaded', registry);
                return registry;
            })
    }

    parseDefinitions(definitions)
    {
        var loader = new Loader(this._logger)
        var registry = null;
        return Promise.resolve()
            .then(() => loader.fromDefinitions(definitions))
            .then(result => {
                this._logger.info('Definitions Loaded.');
                registry = result;
                this._logger.silly('Registry loaded', registry);
                return registry;
            })
    }
}

module.exports = Starter;
