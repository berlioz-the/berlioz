const CliTable = require('./cli-table');
const _ = require('the-lodash');
const util = require('util');
const {stopwatch} = require('durations');

class Screen
{
    constructor(screenWidth)
    {
        this.setupScreen(screenWidth);
    }

    get screenWidth() {
        return this._screenWidth;
    }

    setupScreen(width)
    {
        this._screenWidth = width;
        if (!this._screenWidth) {
            this._screenWidth = 100;
        }
    }

    stopwatch()
    {
        const watch = stopwatch();
        watch.start();
        return {
            finish() {
                watch.stop()
                var ms = watch.duration().millis();
                var seconds = ms / 1000;
                seconds = seconds.toFixed(2);
                return `[${seconds}s]`;
            }
        }
    }

    error(str)
    {
        return this._write('ERROR: ', arguments);
    }

    warn(str)
    {
        return this._write('WARNING: ', arguments);
    }

    info()
    {
        return this._write('', arguments);
    }

    header()
    {
        var msg = this._massageFormat(arguments);
        var line = "";
        var x = (this._screenWidth - msg.length - 2) / 2;
        if (x > 0) {
            line += '*'.repeat((this._screenWidth - msg.length - 2) / 2);
        }
        line += ' ' + msg + ' ';
        var x = this._screenWidth - line.length;
        if (x > 0) {
            line += '*'.repeat(x);
        }
        this._rawOutput();
        this.line();
        this._rawOutput(line);
    }

    line()
    {
        return this._rawOutput('*'.repeat(this._screenWidth));
    }

    _write(header, formats)
    {
        for(var i = 0; i < formats.length; i++)
        {
            if (_.isObject(formats[i]) && !_.isString(formats[i])) {
                formats[i] = JSON.stringify(formats[i], null, 2);
            }
        }
        var line = header + this._massageFormat(formats);
        this._rawOutput(line);
    }

    _rawOutput(line)
    {
        if (!line) {
            console.log();
        } else {
            console.log(line);
        }
    }

    _massageFormat(formats)
    {
        formats = Array.from(formats);
        var values = formats.map(x => {
            if (_.isObject(x)) {
                JSON.stringify(x, null, 2);
            } else {
                return x;
            }
        });
        return util.format.apply(null, values);
    }

    table(headers)
    {
        var table = new CliTable(this, headers);
        return table;
    }

    invertedTable(rows, ignoreKeys)
    {
        var headerMap = {};
        var newRows = [];
        var columns = [];
        for(var row of rows)
        {
            var newRowMap = {};
            for(var entry of row)
            {
                var key = entry[0];
                if (ignoreKeys) {
                    if (_.includes(ignoreKeys, key)) {
                        continue;
                    }
                }
                var value = entry[1];
                if (!(key in headerMap)) {
                    headerMap[key] = _.keys(headerMap).length;
                    columns.push(key);
                }

                newRowMap[key] = value;
            }
            newRows.push(newRowMap);
        }


        var finalRows = [];
        for(var newRowMap of newRows)
        {
            var finalRow = [];
            for(var column of columns)
            {
                var value = 'N/A'
                if (column in newRowMap) {
                    value = newRowMap[column];
                }
                finalRow.push(value);
            }
            finalRows.push(finalRow);
        }

        // console.log("NEW TABLE COLUMNS:")
        // console.log(columns)
        // console.log("FINAL ROWS:")
        // console.log(finalRows)

        var table = this.table(columns);
        return table;
    }

    outputEntity(entity)
    {
        this.header('%s %s', _.toUpper(entity.kind), entity.id);

        var data = [];
        entity.extractData(data);
        this.table()
            .autofitColumn('Property')
            .column('Value')
            .addRange(data)
            .output();

        this.outputLinks(entity);
    }

    outputService(service)
    {
        this.outputEntity(service);

        if (_.values(service.provides).length > 0) {
            this.header('SERVICE %s ENDPOINTS PROVIDED', service.id);
            this.invertedTable(_.values(service.provides).map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['naming', 'dn', 'kind', 'path']).output();
        }
    }

    outputConsumes(item)
    {
        if (item.allLinks.length > 0) {
            this.header('%s %s CONSUMED', _.toUpper(item.kind), item.id);
            this.invertedTable(item.allLinks.map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['naming', 'dn', 'kind', 'path']).output();
        }
    }

    outputLinks(item)
    {
        if (item.allLinks.length > 0) {
            this.header('%s %s LINKS', _.toUpper(item.kind), item.id);
            this.invertedTable(item.allLinks.map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['naming', 'dn', 'kind', 'path', 'dockerfile', 'class', 'subclass', 'extendSymlinks']).output();
        }
    }

    outputDatabase(database)
    {
        this.outputEntity(database);

        this.header('DATABASE %s ATTRIBUTES', database.id);
        this.table(['Name', 'Type', 'Key Type'])
            .addRange(database.attributes, x => [x.name, x.type, x.keyType])
            .output();
    }

    outputQueue(queue)
    {
        this.outputEntity(queue);
    }

    outputTrigger(trigger)
    {
        this.outputEntity(trigger);
    }

    outputSecret(secret)
    {
        this.outputEntity(secret);
    }

    outputLambda(lambda)
    {
        this.outputEntity(lambda);
    }

    outputCluster(cluster)
    {
        this.outputEntity(cluster);

        this.header('CLUSTER %s PROVIDED', cluster.id);
        this.invertedTable(_.values(cluster.provides).map(x => {
            var data = [];
            x.extractData(data);
            return data;
        }), ['naming', 'dn', 'kind', 'path']).output();

        for(var sector of cluster.sectors)
        {
            this.outputSector(sector);
        }

        for(var service of cluster.services)
        {
            this.outputService(service);
        }

        for(var database of cluster.databases)
        {
            this.outputDatabase(database);
        }

        for(var queue of cluster.queues)
        {
            this.outputQueue(queue);
        }

        for(var secret of cluster.secrets)
        {
            this.outputSecret(secret);
        }

        for(var lambda of cluster.lambdas)
        {
            this.outputLambda(lambda);
        }

        for(var trigger of cluster.triggers)
        {
            this.outputTrigger(trigger);
        }
    }

    outputSector(sector)
    {
        this.outputEntity(sector);
    }

 
    outputEndpoints(endpointMap)
    {
        var entries = _.keys(endpointMap).sort().map(id => {
            var entry = endpointMap[id];
            return {
                identity: id,
                endpoint: entry.protocol + '://' + entry.address + ':' + entry.port
            };
        });
        this.table(['Identity', 'Endpoint'])
            .addRange(entries, x => [x.identity, x.endpoint])
            .output();
    }

}

module.exports = Screen;
