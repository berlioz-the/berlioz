const CliTable = require('./cli-table');
const _ = require('the-lodash');
const util = require('util');

class Screen
{
    constructor()
    {

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
        var width = 80;
        var line = '*'.repeat((width - msg.length - 2) / 2);
        line += ' ' + msg + ' ';
        line += '*'.repeat((width - line.length));
        this._rawOutput();
        this._rawOutput('*'.repeat(width));
        this._rawOutput(line);
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
        var data = [];
        entity.extractData(data);

        this.table(['Property', 'Value'])
            .addRange(data)
            .output();
    }

    outputService(service)
    {
        this.header('SERVICE %s :: %s', service.clusterName, service.name);
        this.outputEntity(service);

        if (_.values(service.provides).length > 0) {
            this.header('SERVICE ENDPOINTS PROVIDED %s :: %s', service.clusterName, service.name);
            this.invertedTable(_.values(service.provides).map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['id', 'dn', 'kind', 'path']).output();
        }

        this.outputConsumes(service, 'SERVICE')
    }

    outputConsumes(item, header)
    {
        if (_.values(item.consumes).length > 0) {
            this.header('%s ENDPOINTS CONSUMED %s :: %s', header, item.clusterName, item.name);
            this.invertedTable(_.values(item.consumes).map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['id', 'dn', 'kind', 'path']).output();
        }

        if (_.values(item.databasesConsumes).length > 0) {
            this.header('%s DATABASES CONSUMED %s :: %s', header, item.clusterName, item.name);
            this.invertedTable(_.values(item.databasesConsumes).map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['id', 'dn', 'kind', 'path']).output();
        }

        if (_.values(item.queuesConsumes).length > 0) {
            this.header('%s QUEUES CONSUMED %s :: %s', header, item.clusterName, item.name);
            this.invertedTable(_.values(item.queuesConsumes).map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['id', 'dn', 'kind', 'path']).output();
        }

        if (_.values(item.secretsConsumes).length > 0) {
            this.header('%s SECRETS CONSUMED %s :: %s', header, item.clusterName, item.name);
            this.invertedTable(_.values(item.secretsConsumes).map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['id', 'dn', 'kind', 'path']).output();
        }
    }

    outputDatabase(database)
    {
        this.header('DATABASE %s :: %s', database.clusterName, database.name);
        this.outputEntity(database);

        this.header('DATABASE ATTRIBUTES %s :: %s', database.clusterName, database.name);
        this.table(['Name', 'Type', 'Key Type'])
            .addRange(database.attributes, x => [x.name, x.type, x.keyType])
            .output();
    }

    outputQueue(queue)
    {
        this.header('QUEUE %s :: %s', queue.clusterName, queue.name);
        this.outputEntity(queue);
    }

    outputSecret(secret)
    {
        this.header('SECRET %s :: %s', secret.clusterName, secret.name);
        this.outputEntity(secret);
    }

    outputLambda(lambda)
    {
        this.header('LAMBDA %s :: %s', lambda.clusterName, lambda.name);
        this.outputEntity(lambda);

        this.outputConsumes(lambda, 'LAMBDA')
    }

    outputCluster(cluster)
    {
        this.header('CLUSTER %s', cluster.name);
        this.outputEntity(cluster);

        this.header('CLUSTER PROVIDED %s', cluster.name);
        this.invertedTable(_.values(cluster.provides).map(x => {
            var data = [];
            x.extractData(data);
            return data;
        }), ['id', 'dn', 'kind', 'path']).output();

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
