const Path = require('path');
const _ = require('the-lodash');
const logger = require('../logger');

class Base
{
    constructor(definition, naming)
    {
        this._definition = definition;
        if (!_.isArray(naming)) {
            naming = [naming];
        }
        this._naming = naming;
        this._kind = definition.kind;
        this._id = Base.constructID(this.kind, this.naming);
        this._consumesMap = {};
    }

    get id() {
        return this._id;
    }

    get naming() {
        return this._naming;
    }

    get path() {
        return this._path;
    }

    get berliozfile() {
        return this._berliozfile;
    }

    get definition() {
        return this._definition;
    }

    get kind() {
        return this._kind;
    }

    get registry() {
        return this._registry;
    }

    addToRegistry(registry)
    {
        this._registry = registry;
        this._registry.add(this);

        for(var consumes of _.values(this._consumesMap))
        {
            for(var x of consumes) 
            {
                x.addToRegistry(registry);
            }
        }

        this._handleAddToRegistry(registry);
    }

    _handleAddToRegistry(registry)
    {

    }

    setPath(berliozfile)
    {
        this._berliozfile = berliozfile;
        this._path = Path.dirname(berliozfile);
    }

    extractData(data)
    {
        data.push(['id', this.id]);
        data.push(['path', this.path]);
        data.push(['naming', JSON.stringify(this.naming)]);
        data.push(['kind', this.kind]);
    }

    _getConsumes(name)
    {
        if (!(name in this._consumesMap)) {
            this._consumesMap[name] = [];
        }
        return this._consumesMap[name];
    }

    _addConsumes(name, obj)
    {
        this._getConsumes(name).push(obj);
    }

    _loadConsumesConfig(consumesDef)
    {
        const ConsumedEndpoint = require('./consumed/endpoint');
        const ConsumedDatabase = require('./consumed/database');
        const ConsumedQueue = require('./consumed/queue');
        const ConsumedSecret = require('./consumed/secret');

        if (!consumesDef) {
            return;
        }

        for(var consumer of consumesDef)
        {
            if (consumer.cluster || consumer.service) {
                var def = {
                    endpoint: consumer.endpoint
                };
                if (consumer.cluster) {
                    def.cluster = consumer.cluster;
                } else {
                    def.service = consumer.service;
                }
                var serviceConsumed = new ConsumedEndpoint(def, this);
                this._addConsumes('endpoint', serviceConsumed)
                if(serviceConsumed.targetKind == 'service') {
                    this._addConsumes('local-endpoint', serviceConsumed)
                } else {
                    this._addConsumes('remote-endpoint', serviceConsumed)
                }
            } else if (consumer.database) {
                var def = {
                    name: consumer.database
                };
                var dbConsumed = new ConsumedDatabase(def, this);
                this._addConsumes('database', dbConsumed)
            } else if (consumer.queue) {
                var def = {
                    name: consumer.queue
                };
                var queueConsumed = new ConsumedQueue(def, this);
                this._addConsumes('queue', queueConsumed)
            } else if (consumer.secret) {
                var def = {
                    name: consumer.secret,
                    actions: []
                };
                if (_.isString(consumer.action)) {
                    def.actions.push(consumer.action)
                } else if (_.isArray(consumer.action)) {
                    for (var x of consumer.action) {
                        def.actions.push(x)
                    }
                }
                var secretConsumed = new ConsumedSecret(def, this);
                this._addConsumes('secret', secretConsumed)
            }
        }
    }

    static parseBool(value)
    {
        if (_.isBoolean(value)) {
            return value;
        }
        if (value == 'on' || value == 'yes' || value == 'true') {
            return true;
        } else {
            return false;
        }
    }

    static constructID(kind, naming)
    {
        if (!_.isArray(naming)) {
            naming = [naming];
        }

        var newNaming = [];
        for (var x of naming) {
            if (typeof x !== 'undefined' && x !== null)
            {
                x = x.toString();
                if (x.indexOf('-') >= 0 || x.indexOf('[') >= 0 || x.indexOf(']') >= 0) {
                    x = '[' + x + ']';
                }
            }
            else
            {
                logger.logger.error('Invalid naming: %s', kind, naming);
                throw new Error('Invalid naming: ' + kind);
                x = 'NULL';
            }
            newNaming.push(x);
        }

        var namingStr = newNaming.join('-');
        return kind + '://' + namingStr;
    }

    static breakID(id)
    {
        var re = /^([\w-]+):\/\/(\S*)/;
        var matches = id.match(re);
        if (!matches) {
            logger.logger.error('Could not split id: %s', id);
            return null;
        }
        var kind = matches[1];
        var namingStr = matches[2];

        var naming = [];
        var isWordStarted = false;
        var curr = '';
        var level = 0;
        var processedStr = '';
        for (var ch of namingStr) {
            processedStr = processedStr + ch;
            var realSymbol = true;
            var wordEnd = false;

            if (ch == '[') {
                if (level == 0) {
                    realSymbol = false;
                } else {
                    realSymbol = true;
                }
                level = level + 1;
            }

            if (ch == ']') {
                level = level - 1;
                if (level == 0) {
                    wordEnd = true;
                }
                if (level == 0) {
                    realSymbol = false;
                } else {
                    realSymbol = true;
                }
            }

            if (level < 0) {
                throw new Error('Invalid id [1]: ' + id + ', processed: ' + processedStr);
            }

            if (ch == '-') {
                if (level == 0) {
                    realSymbol = false;
                    wordEnd = true;
                }
            }

            if (realSymbol) {
                isWordStarted = true;
                curr = curr + ch;
            }

            if (wordEnd && isWordStarted) {
                naming.push(curr);
                curr = '';
                isWordStarted = false;
            }
        }

        if (isWordStarted) {
            if (level == 0) {
                naming.push(curr);
                curr = '';
            } else {
                throw new Error('Invalid id [2]: ' + id);
            }
        }

        return {
            kind: kind,
            naming: naming
        };
    }
}

module.exports = Base;
