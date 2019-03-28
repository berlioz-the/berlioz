module.exports = {

    canRunCommand: true,
    useClient: true,

    arguments: [
        {
            name: 'port',
            optional: true
        }
    ],

    exec: function({vorpal, _, Promise, args, client, screen, logger, waiter, parseDefinitions}) {

        var DataProvider = require('./data-provider');
        var dataProvider = new DataProvider(logger, vorpal, client, parseDefinitions);

        const Server = require('../../ui/server');
        var server = new Server(dataProvider);
    }

}
