const CliTable = require('./cli-table');
const _ = require('the-lodash');

class Screen
{
    constructor()
    {

    }

    write(str)
    {
        if (_.isObject(str)) {
            console.log(JSON.stringify(str, null, 2));
        } else {
            console.log(str);
        }
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
        this.write('**** SERVICE ' + service.clusterName + ' :: ' + service.name);
        this.outputEntity(service);
        // for(var provided of _.values(service.provides))
        // {
        //     this.outputEntity(provided);
        // }
        if (_.values(service.provides).length > 0) {
            this.write('****** SERVICE ENDPOINTS PROVIDED ' + service.clusterName + ' :: ' + service.name);
            this.invertedTable(_.values(service.provides).map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['id', 'dn', 'kind', 'path']).output();
        }

        // for(var consumed of _.values(service.consumes))
        // {
        //     this.outputEntity(consumed);
        // }
        if (_.values(service.consumes).length > 0) {
            this.write('****** SERVICE ENDPOINTS CONSUMED ' + service.clusterName + ' :: ' + service.name);
            this.invertedTable(_.values(service.consumes).map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['id', 'dn', 'kind', 'path']).output();
        }


        if (_.values(service.databasesConsumes).length > 0) {
            this.write('****** SERVICE DATABASES CONSUMED ' + service.clusterName + ' :: ' + service.name);
            this.invertedTable(_.values(service.databasesConsumes).map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['id', 'dn', 'kind', 'path']).output();
        }

        if (_.values(service.queuesConsumes).length > 0) {
            this.write('****** SERVICE QUEUES CONSUMED ' + service.clusterName + ' :: ' + service.name);
            this.invertedTable(_.values(service.queuesConsumes).map(x => {
                var data = [];
                x.extractData(data);
                return data;
            }), ['id', 'dn', 'kind', 'path']).output();
        }
    }


    outputDatabase(database)
    {
        this.write('**** DATABASE ' + database.clusterName + ' :: ' + database.name);
        this.outputEntity(database);

        this.write('****** DB ATTRIBUTES ' + database.clusterName + ' :: ' + database.name);
        this.table(['Name', 'Type', 'Key Type'])
            .addRange(database.attributes, x => [x.name, x.type, x.keyType])
            .output();
    }

    outputQueue(queue)
    {
        this.write('**** QUEUE ' + queue.clusterName + ' :: ' + queue.name);
        this.outputEntity(queue);
    }

    outputCluster(cluster)
    {
        this.write('** CLUSTER ' + cluster.name);
        this.outputEntity(cluster);

        this.write('****** CLUSTER PROVIDED ' + cluster.name);
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
        // for(var provided of _.values(cluster.provides))
        // {
        //     this.outputEntity(provided);
        // }
    }
}

module.exports = Screen;
