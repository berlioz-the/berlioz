const Path = require('path');
const _ = require('the-lodash');
const logger = require('../logger');

class Base
{
    constructor(definition, naming)
    {
        // console.log('Creating: ' + naming);
        // console.log('Definition: ' + JSON.stringify(definition, null, 2));
        this.Base = Base;
        this._definition = definition;
        if (!_.isArray(naming)) {
            naming = [naming];
        }
        this._naming = naming;
        this._kind = definition.kind;
        this._id = Base.constructID(this.kind, this.naming);
        this._consumesMap = {};
        this._linkMap = {};
        this._isImplicit = false;
        this._isCompiled = false;

        if (this.definition.consumes) {
            this._loadConsumesConfig(this.definition.consumes)
        }
    }

    toString() {
        return "[" + this._id + "]";
    }

    inspect() {
        return "[" + this._id + "]";
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

    get isImplicit() {
        return this._isImplicit;
    }

    get isCompiled() {
        return this._isCompiled;
    }

    get pairWithConsumer() {
        return this.definition.pairWithConsumer;
    }

    /* CONSUMES */

    get consumes() {
        return _.flatten([this.localConsumes, this.remoteConsumes])
    }

    get localConsumes() {
        return this.getLinks('local-endpoint');
    }

    get remoteConsumes() {
        return this.getLinks('remote-endpoint');
    }

    get databasesConsumes() {
        return this.getLinks('database-consumed');
    }

    get queuesConsumes() {
        return this.getLinks('queue-consumed');
    }

    get secretsConsumes() {
        return this.getLinks('secret-consumed');
    }

    get metaConsumes() {
        return this.getLinks('meta-consumed');
    }

    get triggerConsumes() {
        return this.getLinks('trigger-consumed');
    }

    get lambdaConsumes() {
        return this.getLinks('lambda-consumed');
    }

    /* CONSUMES END */

    addToRegistry(registry)
    {
        this._registry = registry;
        this._registry.add(this);

        for(var link of this.allLinks)
        {
            link.addToRegistry(registry);
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

    getLinks(name) {
        if (!(name in this._linkMap)) {
            this._linkMap[name] = [];
        }
        return this._linkMap[name];
    }

    link(obj, nameOverride)
    {
        var name;
        if (nameOverride) {
            name = nameOverride;
        } else {
            name = obj.kind;
        }
        this.getLinks(name).push(obj);
    }

    get allLinks() {
        return _.flatten(_.values(this._linkMap));
    }

    _loadConsumesConfig(consumesDef)
    {
        const ConsumedEndpoint = require('./consumed/endpoint');
        const ConsumedDatabase = require('./consumed/database');
        const ConsumedQueue = require('./consumed/queue');
        const ConsumedTrigger = require('./consumed/trigger');
        const ConsumedLambda = require('./consumed/lambda');
        const ConsumedSecret = require('./consumed/secret');
        const ConsumedMeta = require('./consumed/meta');

        if (!consumesDef) {
            return;
        }

        for(var consumer of consumesDef)
        {
            var def = _.cloneDeep(consumer);
            if (consumer.meta) {
                delete def.meta;
                
                this._setupConsumerSector(consumer, def); // TODO : maybe not needed
                var metaConsumed = new ConsumedMeta(def, this);
                this.link(metaConsumed)
            } else if (consumer.cluster || consumer.service) {
                this._setupConsumerSector(consumer, def);
                var serviceConsumed = new ConsumedEndpoint(def, this);
                if(serviceConsumed.targetKind == 'service') {
                    this.link(serviceConsumed, 'local-endpoint')
                } else {
                    this.link(serviceConsumed, 'remote-endpoint')
                }
            } else if (consumer.database) {
                delete def.database;
                def.name = consumer.database;
                this._setupConsumerSector(consumer, def);
                var dbConsumed = new ConsumedDatabase(def, this);
                this.link(dbConsumed)
            } else if (consumer.queue) {
                delete def.queue;
                def.name = consumer.queue;
                this._setupConsumerSector(consumer, def);
                var queueConsumed = new ConsumedQueue(def, this);
                this.link(queueConsumed)
            } else if (consumer.trigger) {
                delete def.trigger;
                def.name = consumer.trigger;
                this._setupConsumerSector(consumer, def);
                var triggerConsumed = new ConsumedTrigger(def, this);
                this.link(triggerConsumed)
            } else if (consumer.lambda) {
                delete def.lambda;
                def.name = consumer.lambda;
                this._setupConsumerSector(consumer, def);
                var lambdaConsumed = new ConsumedLambda(def, this);
                this.link(lambdaConsumed)
            } else if (consumer.secret) {
                delete def.secret;
                def.name = consumer.secret;

                delete def.action;
                def.actions = []
                if (_.isString(consumer.action))
                {
                    def.actions.push(consumer.action)
                }
                else if (_.isArray(consumer.action)) 
                {
                    def.actions = _.concat(def.actions, consumer.action)
                }

                this._setupConsumerSector(consumer, def);

                var secretConsumed = new ConsumedSecret(def, this);
                this.link(secretConsumed)
            } 
        }
    }

    _setupConsumerSector(consumer, def)
    {
        if (consumer.sector) {
            def.sector = consumer.sector;
        } else if (this.sectorName) {
            def.sector = this.sectorName;
        } else {
            Base.setupSector(def);
        }
    }

    _getPolicyTarget()
    {
        return null;
    }

    resolvePolicy(name, mandatoryKeys)
    {
        var target = this._getPolicyTarget();
        if (!target) {
            return {};
        }
        return this.registry.resolvePolicy(name, target, mandatoryKeys);
    }

    resolvePolicies(name, mandatoryKeys)
    {
        var target = this._getPolicyTarget();
        if (!target) {
            return {};
        }
        return this.registry.resolvePolicies(name, target, mandatoryKeys);
    }

    _myEnvironment() {
        var policy = this.resolvePolicy('environment');
        return this._mergeEnvironment([
            policy,
            this.definition.environment
        ]);
    }

    _mergeEnvironment(envs)
    {
        envs = _.filter(envs, x => x);
        if (envs.length == 0) {
            return {};
        }
        envs = envs.map(x => _.cloneDeep(x));
        return _.defaultsDeep.apply(null, envs);
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

    static setupSector(definition)
    {
        if (!definition.sector) {
            definition.sector = 'main';
        }
    }
}

module.exports = Base;
