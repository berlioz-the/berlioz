const Promise = require('the-promise');
const _ = require('the-lodash');

const Loader = require('./berlioz-common/loader');

const Extractor = require('./extractor');

const Errors = require('./tools/errors');
const Context = require('./tools/context');
const Storage = require('./tools/storage');
const ConfigRegistry = require('./tools/config-registry');
const BerliozClient = require('./tools/berlioz-client');
const VorpalInterface = require('./tools/vorpal-interface');

const Screen = require('./tools/screen');
const LocalDeployer = require('./tools/local-deployer');
const Shell = require('./tools/shell');
const Docker = require('./tools/docker');
const Waiter = require('./tools/waiter');
const PlantUml = require('./tools/plantuml');

const Autocomplete = require('./autocomplete');

process.on('unhandledRejection', (reason, p) => {
    console.log('[unhandledRejection] Unhandled Rejection at:', p, 'reason:', reason);
    console.log(reason);
    console.log(p);
});


class Starter
{
    constructor(logger, rootDir)
    {
        this._logger = logger;
        this._rootDir = rootDir;
        this._commands = [];

        this._screen = new Screen();
        this._context = new Context(this._logger.sublogger('Context'));
        this._storage = new Storage(this._logger.sublogger('Storage'), this._screen);
        this._configRegistry = new ConfigRegistry(this._logger.sublogger('ConfigRegistry'), this._storage);
        this._client = new BerliozClient(this._logger.sublogger('Client'), this._screen, this._configRegistry);
        this._autocomplete = new Autocomplete(this._logger, this._client);
        this._interface = new VorpalInterface(this._logger,
                                              this._screen,
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
            .catch(reason => {
                this._handleCommandError(commandStr, reason, null);
            })
            ;
    }

    _extractCommands()
    {
        var extractor = new Extractor(this._logger, this._configRegistry.repoStore, this._acceptCommand.bind(this));
        return extractor.process();
    }

    _acceptCommand(command)
    {
        try {
            var commandModule = require(command.includePath);
            if (!commandModule.arguments) {
                commandModule.arguments = []
            }
            if (!commandModule.flags) {
                commandModule.flags = []
            }

            if (commandModule.useProject) {
                commandModule.arguments.push({
                    name: "pathoverride",
                    optional: true
                })
            }

            if (commandModule.useWaiter) {
                if (!commandModule.skipWaitFlag) {
                    commandModule.flags.push("wait");
                }
                commandModule.arguments.push({
                    name: "timeout",
                    optional: true
                })
            }

            this._interface.accept(command, commandModule);
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
                storage: this._storage,
                config: this._configRegistry,
                logger: this._logger,
                screen: this._screen,
                parseDefinitions: this.parseDefinitions.bind(this),
                Promise: Promise,
                _: _
            };

            commandParams.inputError = (msg) => {
                throw new Errors.Input(msg);
            }
            
            commandParams.genericError = (msg) => {
                throw new Errors.Generic(msg);
            }

            commandModule.shell = new Shell(this._logger.sublogger('Shell'), this._screen);

            if (this.needsDocker(commandModule)) {
                commandModule.docker = new Docker(this._logger.sublogger('Docker'), this._screen, commandModule.shell);
                commandParams.docker = commandModule.docker;
            }

            if (commandModule.useLocalDeployer)
            {
                commandParams.localDeployer = new LocalDeployer(this._logger.sublogger('LocalDeployer'), this._configRegistry, commandModule.docker, this._screen, commandModule.shell);
            }

            if (commandModule.usePlantUml)
            {
                commandParams.PlantUml = PlantUml;
            }

            if (commandModule.useDevTools)
            {
                const DevTools = require('./tools/dev-tools');
                commandParams.devTools = new DevTools(this._logger, this._rootDir);
            }

            if (commandModule.useClient) {
                commandParams.client = this._client;
            }

            if (commandModule.usePrompt)
            {
                var prompt = require('prompt');
                commandModule.prompt = prompt;
                commandParams.runPrompt = (schema) =>
                    {
                        return new Promise(function(resolve, reject) {
                            prompt.start();
                            prompt.message = null;
                            prompt.get(schema, (err, result) => {
                                if (err)
                                {
                                    reject(err);
                                }
                                else
                                {
                                    resolve(result);
                                }
                            });
                        });
                    }
            }

            if (commandModule.useWaiter)
            {
                var isEnabled = true;
                if (!commandModule.skipWaitFlag) {
                    isEnabled = commandParams.args["wait"];
                }
                commandParams.waiter = new Waiter(this._logger.sublogger("Waiter"),
                                                  this._screen,
                                                  this._client,
                                                  isEnabled,
                                                  commandParams.args["timeout"]);
            }

            return Promise.resolve()
                .then(() => this.readyToRun(commandModule, commandParams))
                .then(() => {
                    // return commandModule.docker.isDockerRunning()
                    //     .then(res => {
                    //         this._logger.info('Docker Info: ', res);
                    //     });
                })
                .then(() => {
                    if (commandModule.useProject)
                    {
                        return this._loadDefinitions(commandParams.args["pathoverride"])
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
                .catch(error => {
                    this._handleCommandError(info.command, error, commandModule);
                })
                .then(() => {
                    this._commandCleanup(commandModule);
                })
                .then(result => {
                    callback();
                });

        } catch(error) {
            this._handleCommandError(info.command, error, commandModule);
        }
    }

    _commandCleanup(commandModule)
    {
        if (commandModule.usePrompt)
        {
            if (commandModule.prompt) 
            {
                commandModule.prompt.stop();
                commandModule.prompt = null;
            }
        }
    }

    readyToRun(commandModule, commandParams)
    {
        return Promise.resolve()
            .then(() => this._checkDocker(commandModule, commandParams))
            ;
    }

    _checkDocker(commandModule, commandParams)
    {
        if (this.needsDocker(commandModule)) {
            this._logger.info('Checking docker...');
            return commandModule.docker.isDockerRunning()
                .then(result => {
                    if (!result) {
                        throw new Errors.MissingPrerequisite('Docker not running.');
                    }
                })
        }
    }

    needsDocker(commandModule)
    {
        if (commandModule.useDocker || commandModule.useLocalDeployer) {
            return true;
        }
        return false;
    }

    _handleCommandError(commandName, error, commandModule)
    {
        if (commandModule)
        {
            this._commandCleanup(commandModule);
        }

        if (error instanceof Errors.Auth) {
            if (!error.message) {
                this._screen.error('Unauthorized.');
            } else {
                this._screen.error(error.message)
            }
            this._screen.info('Please login using: \'berlioz login --region <...>\', or register using: \'berlioz signup\'.')
            return this.terminate(1);
        } else if (error instanceof Errors.MissingPrerequisite) {
            this._screen.error(error.message);
            return this.terminate(2);
        } else if (error instanceof Errors.Input) {
            this._screen.error(error.message);
            return this.terminate(3);
        } else if (error instanceof Errors.Generic) {
            this._screen.error(error.message);
            return this.terminate(4);
        }

        this._logger.exception(error);
        this._logger.error('Error running command %s.', commandName);
        console.log(error)
        
        return this.terminate(5);
    }

    _autocompleteProcessor(name)
    {
        return this._autocomplete.create(name);
    }

    _loadDefinitions(pathOverride)
    {
        var registry = null;
        var dirs = null;
        if (pathOverride) {
            dirs = pathOverride.split(',')
        } else {
            dirs = ['.']
        }
        return Promise.resolve()
            .then(() => {
                var loader = new Loader(this._logger)
                return loader.fromDirs(this._rootDir, dirs)
            })
            .then(result => {
                this._logger.verbose('Definitions Loaded.');
                registry = result;
                // this._logger.debug('Registry loaded', registry);
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

    terminate(code)
    {
        this._logger.flush();
        process.exitCode = code;
        // process.exit(code);
    }
}

module.exports = Starter;
