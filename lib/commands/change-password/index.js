module.exports = {

    usePrompt: true,
    useClient: true,

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

                    return performPasswordChange(username, password);
                });
        }
        else
        {
            return performPasswordChange(args.user, args.pass);
        }

        function performPasswordChange(username, password)
        {
            var payload = {
                user: username,
                pass: password
            }
            return client.requestToAAA("POST", "/change-password", payload)
                .then(result => {
                    screen.info('Password reset successful.');
                    if (result.message) {
                        screen.info(result.message);
                    }
                });
        }
    }
}
