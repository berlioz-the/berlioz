const Table = require('cli-table');
const _ = require('the-lodash');

class CliTable
{
    constructor(headers)
    {
        this._table = new Table({
            head: headers
        });
    }

    addRow(data, predicate)
    {
        var row = data;
        if (predicate) {
            row = predicate(data);
        }
        this._table.push(row.map(x => {
            if (_.isBoolean(x)) {
                return x.toString();
            }
            if (x) {
                return x;
            }
            return '';
        }));
        return this;
    }

    addRange(data, predicate)
    {
        for (var row of data) {
            this.addRow(row, predicate);
        }
        return this;
    }

    output() {
        console.log(this._table.toString());
    }
}

module.exports = CliTable;
