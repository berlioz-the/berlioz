const Path = require('path');
const fs = require('fs');
const os = require('os');
const _ = require('the-lodash');

const RepoStore = require('processing-tools/repo-store');

class ConfigRegistry
{
    constructor(logger)
    {
        this._logger = logger;
        this._repoStore = new RepoStore(logger, 'config');
        this._repoStore.setupRepository('config', 'GENERAL CONFIG');
        this._repoStore.setupRepository('global', 'GLOBAL DATA');
        this._repoStore.setupRepository('auth', 'LOGIN DATA');
        this._repoStore.setupRepository('clusters', 'CLUSTER DEFINITIONS');
        this._repoStore.setupRepository('repository', 'IMAGE REPOSITORY DATA');
    }

    get repoStore() {
        return this._repoStore;
    }

    get(section, name)
    {
        this._logger.silly('GET %s :: %s...', section, name);
        return this._repoStore.get(section, this._getKeyPath(name));
    }

    getAll(section)
    {
        this._logger.silly('GET %s...', section);
        return this._repoStore.get(section, []);
    }

    set(section, name, value)
    {
        this._logger.silly('SET %s :: %s...', section, name);
        this._repoStore.set(section, this._getKeyPath(name), value);
    }

    _getKeyPath(name)
    {
        if (_.isString(name)) {
            return [name];
        } else if (_.isArray(name)) {
            return name;
        }
        throw new Error('Unknown config key path: ' + name);
    }

    clear(section, name)
    {
        this._repoStore.delete(section, this._getKeyPath(name));
    }

    _getPath()
    {
        return Path.resolve(os.homedir(), '.berlioz', 'config-store');
    }

    loadData()
    {
        return this._repoStore.loadFromFile(this._getPath());
    }

    saveData()
    {
        this._logger.verbose('[ConfigRegistry::saveData] ...');
        return this._repoStore.saveToFile(this._getPath());
    }
}

module.exports = ConfigRegistry;
