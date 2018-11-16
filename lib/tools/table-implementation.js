const BaseTableImplementation = require("../berlioz-common/interfaces/base-table-implementation");
const _ = require("the-lodash");
const Promise = require("the-promise");

class TableImplementation extends BaseTableImplementation
{
    constructor(logger, repoStore)
    {
        super();
        this._logger = logger;
        this._repoStore = repoStore;
    }

    _tableName(name) {
        return "local-" + name;
    }

    queryAll(name, scope)
    {
        var res = this._repoStore.get(this._tableName(name), []);
        if (!res) {
            res = {};
        }
        var filteredRes = {}
        for(var x of _.keys(res)) {
            var row = res[x];
            if (this._matchesScope(row, scope)) {
                filteredRes[x] = row;
            }
        }
        return filteredRes;
    }

    _matchesScope(row, scope) {
        for(var key of _.keys(scope)) {
            if (row[key] != scope[key]) {
                return false;
            }
        }
        return true;
    }

    create(name, key, obj)
    {
        this._logger.info("[create] %s :: %s => ", name, key, obj);
        this._repoStore.set(this._tableName(name), [key], obj);
        return this._handleChange(name, key);
    }

    update(name, key, obj)
    {
        return this.create(name, key, obj);
    }

    delete(name, key)
    {
        this._logger.info("[delete] %s :: %s", name, key);
        this._repoStore.delete(this._tableName(name), [key]);
        return this._handleChange(name, key);
    }

    _handleChange(name, key)
    {
    }
}

module.exports = TableImplementation;