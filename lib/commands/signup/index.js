
module.exports = {

    usePrompt: true,

    arguments: [
    ],

    exec: function({Promise, _, args, logger, screen, client, runPrompt}) {
        var schema = {
            properties: {
                username: {
                    pattern: /^\S*$/,
                    message: 'Name must be only letters, spaces, or dashes',
                    required: true
                },
                email: {
                    pattern: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
                    message: 'Must be a valid email address',
                    required: true
                },
                password: {
                    hidden: true,
                    required: true
                }
            }
        };

        var signupData;
        return runPrompt(schema)
            .then(result => {
                signupData = _.clone(result);
                return client.preSignup({username: result.username});
            })
            .then(result => {
                _.defaults(signupData, result);
                schema = {
                    properties: {
                        answer: {
                            message: result.question,
                            required: true
                        }
                    }
                };
                return runPrompt(schema);
            })
            .then(result => {
                _.defaults(signupData, result);
                return client.signup(signupData);
            })
            .then(result => {
                screen.info('User %s registered successfully.', result.user);
                if (!result.userConfirmed) {
                    screen.info('Please check your email to activate the account.');
                }
            });
    }
}
