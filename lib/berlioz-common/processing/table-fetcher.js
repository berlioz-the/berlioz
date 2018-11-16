const Promise = require("the-promise");
const _ = require("the-lodash");

class TableFetcher
{
    constructor(logger, name, tableImpl)
    {
        this._logger = logger;
        this._name = name;
        this._impl = tableImpl;
        this._cache = {};
    }

    query(filters)
    {
        this._logger.info("[query] %s :: ", this._name, filters);

        var filterTag = _.stableStringify(filters);
        if (filterTag in this._cache) {
            return Promise.resolve(this._cache[filterTag]);
        }
        return Promise.resolve(this._impl.queryAll(this._name, filters))
            .then(result => {
                this._cache[filterTag] = result;
                return result;
            });
    }
}

module.exports = TableFetcher;