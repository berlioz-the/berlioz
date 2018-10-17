const _ = require('the-lodash');

class Autocomplete
{
    constructor(logger, client)
    {
        this._logger = logger;
        this._client = client;
        this._remoteAutocompletion = {
            'cluster' : true,
            'deployment' : true,
            'region' : true,
            'provider': true
        }
        this._staticValues = {
            'provider_kind': ['aws'],
            'all_regions': ['us-east-1', 'us-west-1']
        }
    }

    create(optionName)
    {
        return (str, ctx) => {
            // this._logger.info('Autocomplete: %s...', optionName);
            return Promise.resolve()
                .then(() => {
                    if (this._staticValues[optionName]) {
                        return Promise.resolve(this._staticValues[optionName]);
                    }

                    if (optionName in this._remoteAutocompletion) {
                        return this._performRemote(optionName, ctx.options);
                    }
                })
                .then(result => {
                    if (!result) {
                        return [];
                    }
                    return result;
                })
                .catch(error => {
                    return [];
                });
        }
    }

    _performRemote(optionName, options)
    {
        var data = {
            name: optionName,
            options: options
        };

        // this._logger.info('Running remote autocomplete: ', data);

        return this._client.postMaster('/cli/autocomplete', data)
            .then(result => {
                // this._logger.info('Autocomplete result: ', result);
                return result;
            })
            .catch(reason => {
                // this._logger.error('ERROR:', reason);
                return null;
            });
    }



}

module.exports = Autocomplete;
