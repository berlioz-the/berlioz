var prompt = require('prompt');

module.exports = {

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

    exec: function({Promise, _, args, logger, screen, client}) {
        var schema = {
            properties: {

            }
        };

        if (!args.user)
        {
            schema.properties.user = {
                pattern: /^[a-zA-Z\s\-]+$/,
                message: 'Name must be only letters, spaces, or dashes',
                required: true
            };
        }
        if (!args.pass)
        {
            schema.properties.password = {
                hidden: true
            };
        }

        if (_.keys(schema.properties).length > 0)
        {
            return runPrompt()
                .then(result => {
                    var username = args.user || result.user;
                    var password = args.pass || result.password;

                    return performLogin(username, password);
                });
        }
        else
        {
            return performLogin(args.user, args.pass);
        }

        function runPrompt()
        {
            return new Promise(function(resolve, reject) {
                prompt.start();
                prompt.message = null;
                prompt.get(schema, (err, result) => {
                    if (err)
                    {
                        reject(err);
                    }
                    else
                    {
                        resolve(result);
                    }
                });
            });
        }

        function performLogin(username, password)
        {
            return client.login(username, password)
                .then(result => {
                    screen.write('Login successful.');
                })
                .catch(reason => {
                    screen.write('Login failed.');
                });
        }
    }
}
