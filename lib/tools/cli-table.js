const Table = require('cli-table');
const _ = require('the-lodash');
const wrap = require('word-wrap');

class CliTable
{
    constructor(screen, headers)
    {
        this._screen = screen;
        this._columns = [];
        this._rows = [];

        if (headers) {
            for(var header of headers) {
                this.column(header);
            }
        }
    }

    column(name, width, isFixed)
    {
        var column = {
            name: name
        };
        if (isFixed) {
            if (!width) {
                throw new Error('Missing fixed width');
            }
            column.fixedWidth = width;
            column.isFixed = true;
        } else {
            if (!width) {
                width = 1;
            }
            column.relativeWidth = width;
            column.isFixed = false;
        }
        return this._insertColumn(column);
    }

    autofitColumn(name)
    {
        var column = {
            name: name,
            autofit: true
        };
        return this._insertColumn(column);
    }

    _insertColumn(column)
    {
        column.index = this._columns.length;
        this._columns.push(column);
        return this;
    }

    addRow(data, predicate)
    {
        var row = data;
        if (predicate) {
            row = predicate(data);
        }
        if (row.length != this._columns.length) {
            console.log("----------------------")
            console.log(this._columns.map(x => x.name))
            console.log(row)
            throw new Error(`Cell count does not match with column count`);
        }
        this._rows.push(row.map(x => {
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

    addRange(rows, predicate)
    {
        for (var row of rows) {
            this.addRow(row, predicate);
        }
        return this;
    }

    output() {
        var innerWidth = this._screen.screenWidth;
        innerWidth = innerWidth - (this._columns.length - 1);

        for(var column of this._columns)
        {
            if (column.autofit)
            {
                var widths = this._rows.map(x => x[column.index].length);
                widths.push(column.name.length);
                column.isFixed = true;
                column.fixedWidth = _.max(widths);
            }
        }

        for(var column of this._columns)
        {
            if (column.isFixed) {
                column.width = column.fixedWidth + 3;
                innerWidth = innerWidth - column.width;
            }
        }

        var relativeColumns = this._columns.filter(x => !x.isFixed);
        var totalRelativeWidth = _.sumBy(relativeColumns, x => x.relativeWidth);

        for(var column of relativeColumns)
        {
            var width = (innerWidth * column.relativeWidth / totalRelativeWidth);
            if (width < 1) {
                width = 1;
            }
            column.width = Math.floor(width);
        }

        var opts = {
            head: this._columns.map(x => x.name),
            colWidths: this._columns.map(x => x.width)
        }
        var table = new Table(opts);
        for(var row of this._rows)
        {
            var massagedRow = [];
            for(var i = 0; i < row.length; i++) 
            {
                massagedRow.push(this._massageCell(row[i], this._columns[i]));
            }
            table.push(massagedRow);
        }
        this._screen._rawOutput(table.toString());
    }

    _massageCell(cell, column)
    {
        return wrap(cell, {
            width: column.width - 3, 
            indent: '',
            cut: true
        });
    }
}

module.exports = CliTable;
