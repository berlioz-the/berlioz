const CliTable = require('./cli-table');
const _ = require('the-lodash');
const util = require('util');
const {stopwatch} = require('durations');

const LINE_WIDTH = 80;

class Screen
{
    constructor()
    {

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
        var x = (LINE_WIDTH - msg.length - 2) / 2;
        if (x > 0) {
            line += '*'.repeat((LINE_WIDTH - msg.length - 2) / 2);
        }
        line += ' ' + msg + ' ';
        var x = LINE_WIDTH - line.length;
        if (x > 0) {
            line += '*'.repeat(x);
        }
        this._rawOutput();
        this.line();
        this._rawOutput(line);
    }

    line()
    {
        return this._rawOutput('*'.repeat(LINE_WIDTH));
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
        var table = new CliTable(headers);
        return table;
    }

    invertedTable(rows, ignoreKeys)
    {
        var headerMap = {};
        var newRows = [];
        for(var row of rows)
        {
            var newRow = [];
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
                }
                var index = headerMap[key];
                while(index >= newRow.length) {
                    newRow.push('N/A');
                }
                newRow[index] = value;
            }
            newRows.push(newRow);
        }
        var table = new CliTable(_.keys(headerMap));
        table.addRange(newRows);
        return table;
    }

    outputEntity(entity)
    {
        this.header('%s %s', _.toUpper(entity.kind), entity.id);

        var data = [];
        entity.extractData(data);
        this.table(['Property', 'Value'])
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
