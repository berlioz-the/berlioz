const Promise = require('the-promise');
const _ = require('the-lodash');

const Loader = require('./berlioz-common/loader');

const Extractor = require('./extractor');

const CommonErrors = require('./berlioz-common/errors');
const Errors = require('./tools/errors');
const Context = require('./tools/context');
const Storage = require('./tools/storage');
const ConfigRegistry = require('./tools/config-registry');
const BerliozClient = require('./tools/berlioz-client');
const AccountDataProvider = require('./tools/account-data-provider');
const GcpHelper = require('./tools/gcp-helper');
const VorpalInterface = require('./tools/vorpal-interface');

const Screen = require('./tools/screen');
const LocalDeployer = require('./tools/local-deployer');
const Shell = require('./tools/shell');
const Docker = require('./tools/docker');
const Waiter = require('./tools/waiter');
const PlantUml = require('./tools/plantuml');
const Environment = require('./tools/environment');

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
        this._environment = new Environment(this._logger.sublogger('Environment'), this._storage);
        this._configRegistry = new ConfigRegistry(this._logger.sublogger('ConfigRegistry'), this._storage);
        this._client = new BerliozClient(this._logger.sublogger('Client'), this._screen, this._configRegistry, this._environment);
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
        var extractor = new Extractor(this._logger, this._configRegistry.repoStore, this._acceptCommand.bind(this), this._environment);
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
                commandModule.arguments.push({
                    name: "ignoredirs",
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

            if (commandModule.useClient) {
                commandModule.flags.push("skip-ssl");
            }

            commandModule.flags.push("wide-screen");
            commandModule.flags.push("narrow-screen");

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

    _executeCommand(info, commandModule, args)
    {
        this._logger.info('Running command: %s...', info.command);
        this._logger.info('ARGS: ', args);
        var commandResult = null;
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
            
            if (commandParams.args["wide-screen"]) {
                this._screen.setupScreen(120);
            } else if (commandParams.args["narrow-screen"]) {
                this._screen.setupScreen(80);
            }

            commandParams.inputError = (msg) => {
                throw new Errors.Input(msg);
            }
            
            commandParams.genericError = (msg) => {
                throw new CommonErrors.Generic(msg);
            }

            if (commandModule.canRunCommand) {
                commandParams.vorpal = this._interface;
            }

            commandModule.shell = new Shell(this._logger.sublogger('Shell'), this._screen);
            commandParams.shell = commandModule.shell;

            if (this.needsDocker(commandModule)) {
                commandModule.docker = new Docker(
                    this._logger.sublogger('Docker'), 
                    this._screen, 
                    commandModule.shell, 
                    this._environment);
                commandParams.docker = commandModule.docker;
            }

            if (commandModule.useLocalDeployer)
            {
                commandParams.localDeployer = new LocalDeployer(
                    this._logger.sublogger('LocalDeployer'), 
                    this._configRegistry, 
                    commandModule.docker, 
                    this._screen, 
                    commandModule.shell, 
                    this._environment, 
                    this._storage);
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
                commandParams.dataProvider = new AccountDataProvider(this._client);

                if (commandParams.args["skip-ssl"]) {
                    this._screen.info("NOTE: Skipped SSL checks.")
                    commandParams.client.setSkipSSL(true);
                } else {
                    commandParams.client.setSkipSSL(false);
                }
            }

            if (commandModule.useGcpHelper) {
                commandParams.gcpHelper = new GcpHelper(
                    commandParams.logger,
                    commandParams.screen,
                    commandParams.dataProvider, 
                    commandParams.inputError, 
                    commandParams.shell,
                    commandParams.storage
                );
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
                        return this._loadDefinitions(commandParams.args["pathoverride"], commandParams.args["ignoredirs"])
                            .then(registry => {
                                commandParams.registry = registry
                                var validator = registry.validate();
                                validator.enforce();
                            });
                    }
                })
                .then(() => {
                    this._logger.verbose('Launching command %s...', info.command);
                })
                .then(() => {
                    if (commandModule.fetch) {
                        return Promise.resolve(commandModule.fetch(commandParams))
                            .then(result => {
                                commandParams.result = result;
                                commandResult = result;
                            });
                    }
                })
                .then(() => {
                    if (!args.options['fetch-only']) {
                        return Promise.resolve(commandModule.exec(commandParams))
                            .then(result => {
                                commandResult = result;
                            })
                    }
                })
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
                .then(() => {
                    return commandResult;
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

        if (error instanceof CommonErrors.Entity) {
            this._screen.info(error.message);
            error.validator.outputScreen(this._screen);
            return this.terminate(5);
        } else if (error instanceof Errors.Auth) {
            if (!error.message) {
                this._screen.error('Unauthorized.');
            } else {
                this._screen.error(error.message)
            }
            this._screen.info('Please login using: \'berlioz login\', or register using: \'berlioz signup\'.')
            return this.terminate(1);
        } else if (error instanceof Errors.MissingPrerequisite) {
            this._screen.error(error.message);
            return this.terminate(2);
        } else if (error instanceof Errors.Input) {
            this._screen.error(error.message);
            return this.terminate(3);
        } else if (error instanceof CommonErrors.Generic) {
            this._screen.error(error.message);
            return this.terminate(4);
        }

        // this._logger.exception(error);

        this._logger.warn('Error running command \"%s\"', commandName);
        var commandStr = commandName.join(' ');
        this._screen.error('Error running command %s.', commandStr);

        this._logger.warn('Reason: %s.', error.message);
        this._screen.error('Reason: %s', error.message);
        
        return this.terminate(5);
    }

    _autocompleteProcessor(name)
    {
        return this._autocomplete.create(name);
    }

    _loadDefinitions(pathOverride, ignoredirs)
    {
        this._logger.info("[_loadDefinitions] pathOverride=%s, ignoredirs=%s", pathOverride, ignoredirs)
        var registry = null;
        var dirs = null;
        if (pathOverride) {
            if (_.isString(pathOverride)) {
                dirs = pathOverride.split(',')
            }
        } else {
            dirs = ['.']
        }
        
        if (ignoredirs) {
            if (_.isString(ignoredirs)) {
                ignoredirs = ignoredirs.split(',');
            }
        } else {
            ignoredirs = [];
        }

        return Promise.resolve()
            .then(() => {
                var loader = new Loader(this._logger)
                return loader.fromDirs(this._rootDir, dirs, ignoredirs)
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
