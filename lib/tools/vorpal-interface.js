const _ = require('the-lodash');
const Promise = require('the-promise');
const fs = require('fs');
const Path = require('path');
// const Vorpal = require('vorpal');
const Vorpal = require('../external/vorpal.git/dist/vorpal.js');
const HelpProcessor = require('../help-processor');
const Errors = require('./errors');

class VorpalInterface
{
    constructor(logger, screen, executeCb, autocompleteProcessor)
    {
        this._logger = logger;
        this._screen = screen;
        this._executeCb = executeCb;
        this._autocompleteProcessor = autocompleteProcessor;
        this._vorpal = Vorpal();
    }

    accept(info, commandModule)
    {
        this._logger.verbose('Accepting %s...', info.includePath);

        var command = this._vorpal
            .command(info.command.join(' '))
            .action((args, callback) => {
                this._processArgs(commandModule, args);
                this._executeCb(info, commandModule, args, callback);
            });

        if (commandModule.arguments)
        {
            for(var x of commandModule.arguments)
            {
                this._acceptCommandArgument(commandModule, command, x);
            }
        }

        if (commandModule.flags)
        {
            for(var x of commandModule.flags)
            {
                var str;
                if (_.isObject(x)) {
                    str = '--' + x.name;
                } else {
                    str = '--' + x;
                }
                command.option(str);
            }
        }

        if (fs.existsSync(info.descrPath))
        {
            var descrContents = fs.readFileSync(info.descrPath, {encoding: 'utf8'});
            var shortDescription;
            var indexEnd = descrContents.indexOf('\n');
            if (indexEnd == -1) {
                shortDescription = descrContents;
            } else {
                shortDescription = descrContents.substring(0, indexEnd);
            }
            command.description(shortDescription);
            command.help((args, callback) => {
                this._screen.info(command.helpInformation());
                var helpProc = new HelpProcessor()
                helpProc.setTextOnly(true);
                var cliHelp = helpProc.process(descrContents);
                this._screen.info(cliHelp);
                callback();
            });
        }
    }

    _acceptCommandArgument(commandModule, command, x)
    {
        if (_.isObject(x)) {
            var autocompleteName = x.name;
            if (x.autocomplete_target) {
                autocompleteName = x.autocomplete_target;
            }
            this._acceptCommandArgumentX(commandModule, command, x.name, x.optional, autocompleteName);
        } else {
            this._acceptCommandArgumentX(commandModule, command, x, false, x);
        }
    }

    _acceptCommandArgumentX(commandModule, command, name, isOptional, autocompleteName)
    {
        var str = '--' + name + ' ';
        if (isOptional) {
            str += '[value]';
        } else {
            str += '<value>';
        }

        var autocompleteCb = null;
        if (autocompleteName)
        {
            autocompleteCb = this._autocompleteProcessor(autocompleteName);
        }

        var massagedAutocompleteCb = null;
        if (autocompleteCb)
        {
            massagedAutocompleteCb = (input, ctx) => {
                var options = {};
                for(var argument of commandModule.arguments)
                {
                    var argumentName;
                    var autocompletionName;
                    if (_.isObject(argument)) {
                        argumentName = argument.name;
                        if (argument.autocomplete_target) {
                            autocompletionName = argument.autocomplete_target;
                        } else {
                            autocompletionName = argument.name;
                        }
                    } else {
                        argumentName = argument;
                        autocompletionName = argument;
                    }
                    if (argumentName in ctx.options)
                    {
                        options[autocompletionName] = ctx.options[argumentName];
                    }
                }
                ctx.options = options;
                return autocompleteCb(input, ctx);
            };
        }

        command.option(str, '', massagedAutocompleteCb);
    }

    interactive()
    {
        return this._vorpal
          .delimiter('berlioz$')
          .show();
    }

    exec(argStr)
    {
        _.remove(this._vorpal.commands, x => x._name == 'exit');

        return this._vorpal.exec(argStr)
            .then((data) => {
                if (data == 'Invalid command.') {
                    throw new Errors.Input(data);
                }
                return data;
            })
    }

    _processArgs(commandModule, args)
    {
        if (commandModule.flags)
        {
            for(var x of commandModule.flags)
            {
                var name;
                if (_.isObject(x)) {
                    name = x.name
                } else {
                    name = x;
                }
                if (x in args.options)
                {
                    if ((args.options[x] == true) || (args.options[x] == 'true')) {
                        args.options[x] = true;
                    } else {
                        args.options[x] = false;
                    }
                } else {
                    args.options[x] = false;
                }
            }
        }
    }
}

module.exports = VorpalInterface;
