module.exports = {

    usePrompt: true,

    arguments: [
        {
            name: 'user',
            optional: true
        },
        {
            name: 'pass',
            optional: true
        }
    ],

    exec: function({Promise, _, args, logger, screen, client, runPrompt}) {
        var schema = {
            properties: {

            }
        };

        if (!args.user)
        {
            schema.properties.username = {
                pattern: /^\S*$/,
                message: 'Name must be only letters, spaces, or dashes',
                required: true
            };
        }
        if (!args.pass)
        {
            schema.properties.password = {
                hidden: true,
                required: true
            };
        }

        if (_.keys(schema.properties).length > 0)
        {
            return runPrompt(schema)
                .then(result => {
                    var username = args.user || result.username;
                    var password = args.pass || result.password;

                    return performLogin(username, password);
                });
        }
        else
        {
            return performLogin(args.user, args.pass);
        }

        function performLogin(username, password)
        {
            return client.login(username, password)
                .then(result => {
                    screen.info('Login successful.');
                });
        }
    }
}
