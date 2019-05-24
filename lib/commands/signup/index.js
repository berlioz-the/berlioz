
module.exports = {

    usePrompt: true,
    useClient: true,

    arguments: [
    ],

    exec: function({Promise, _, args, logger, screen, client, runPrompt}) {
        var schema = {
            properties: {
                email: {
                    pattern: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
                    message: 'Must be a valid email address',
                    required: true
                },
                pass: {
                    hidden: true,
                    required: true
                }
            }
        };

        var signupData;
        return Promise.resolve()
            .then(() => runPrompt(schema)) 
            .then(result => {
                signupData = _.clone(result);
            })
            // .then(() => {
            //     return client.requestToAAA('POST', '/presignup', {email: result.email});
            // })
            // .then(result => {
            //     _.defaults(signupData, result);
            //     schema = {
            //         properties: {
            //             answer: {
            //                 message: result.question,
            //                 required: true
            //             }
            //         }
            //     };
            //     return runPrompt(schema);
            // })
            // .then(result => {
            //     _.defaults(signupData, result);
            // })
            .then(() => {
                return client.requestToAAA('POST', '/signup', signupData);
            })
            .then(result => {
                screen.info('User %s registered successfully.', signupData.email);
                if (!result.userConfirmed) {
                    screen.info('Please check your email to activate the account.');
                }
            });
    }
}
