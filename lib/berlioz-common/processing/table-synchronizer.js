const Promise = require("the-promise");
const _ = require("the-lodash");

class TableSynchronizer
{
    constructor(logger, name, tableImpl, scope, customHandler)
    {
        this._logger = logger;
        this._name = name;
        this._impl = tableImpl;
        this._scope = scope;
        this._customHandler = customHandler;

        this._desired = {};
    }

    add(key, row)
    {
        row = _.defaults(row, this._scope);
        this._logger.debug("[add] %s :: %s => ", this._name, key, row);
        this._desired[key] = row;
    }

    sync()
    {
        this._logger.debug("[sync] %s :: Desired: ", this._name, this._desired);
        return Promise.resolve(this._impl.queryAll(this._name, this._scope))
            .then(current => this._processCurrent(current))
        ;
    }

    _processCurrent(current)
    {
        this._logger.debug("[_processCurrent] %s :: Current: ", this._name, current);
        var delta = this._produceDelta(current);

        this._logger.debug("[_processCurrent] %s :: Delta: ", this._name, delta);
        return this._processDelta(delta)
    }

    _processDelta(delta)
    {
        return Promise.serial(_.keys(delta), x => this._processDeltaRow(x, delta[x]));
    }

    _processDeltaRow(key, delta)
    {
        return Promise.resolve(this._processDeltaRowImpl(key, delta))
            .then(() => {
                if (this._customHandler) {
                    return this._customHandler(key, delta);
                }
            })
    }

    _processDeltaRowImpl(key, delta)
    {
        this._logger.debug("[_processDeltaRow] %s :: %s => ", this._name, key, delta);
        if (delta.status == "create") {
            return this._impl.create(this._name, key, delta.row);
        } else if (delta.status == "update") {
            return this._impl.update(this._name, key, delta.row);
        } else if (delta.status == "delete") {
            return this._impl.delete(this._name, key);
        }
    }

    _produceDelta(current)
    {
        var delta = {};

        for(var key of _.keys(this._desired)) {
            var row = this._desired[key];
            if (key in current) {
                var existingRow = current[key];
                if (!_.fastDeepEqual(row, existingRow)) {
                    delta[key] = {
                        status: 'update',
                        existingRow: existingRow,
                        row: row
                    }
                }
            } else {
                delta[key] = {
                    status: 'create',
                    row: row
                }
            }
        }

        for(var key of _.keys(current)) {
            if (!(key in this._desired)) {
                delta[key] = {
                    status: 'delete',
                    row: current[key]
                }
            }
        }

        return delta;
    }
}

module.exports = TableSynchronizer;