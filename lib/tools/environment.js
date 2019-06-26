const _ = require('the-lodash');
const yaml = require('js-yaml');

class Environment
{
    constructor(logger, storage)
    {
        this._logger = logger;
        this._storage = storage;

        this._load();
        if (!this._customEnv) {
            this._customEnv = {};
        }

        this._logger.info('CustomEnv: ', this._customEnv);

        this._env = _.clone(process.env);
        this._env = _.defaults(this._env, this._customEnv);

        this._logger.debug('FinalEnv: ', this._env);
    }

    get map() {
        return this._env;
    }

    getValue(name) {
        if (name in this._env) {
            return this._env[name];
        }
        return null;
    }

    _load()
    {
        if (!this._storage) {
            return;
        }
        var fileContentsStr = this._storage.readConfigFile('env.yaml');
        if (!fileContentsStr) {
            return;
        }

        this._customEnv = yaml.safeLoad(fileContentsStr);
    }
}

module.exports = Environment;