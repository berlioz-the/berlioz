const request = require('request-promise');

var AAA_BASE_URL = 'https://cr3gj6kasl.execute-api.us-east-1.amazonaws.com/prod';
var BASE_URL = 'https://kzg4eo15y2.execute-api.us-east-1.amazonaws.com/prod';
var INTERNAL_URL = 'https://n2l97kuybh.execute-api.us-east-1.amazonaws.com/prod';

class BerliozClient
{
    constructor(logger, configRegistry)
    {
        this._logger = logger;
        if (!logger) {
            this._logger = {
                info: function() {},
                warning: function() {},
                error: function() {},
                exception: function() {},
            }
        }
        this._configRegistry = configRegistry;
    }

    login(username, password)
    {
        this.logout();
        return this._rawRequest('POST', AAA_BASE_URL, '/login', { user: username, pass: password })
            .then(result => {
                // console.log(result);
                if (result) {
                    if (result.success) {
                        this._configRegistry.set('auth', 'token', result.id_token);
                        return result;
                    }
                }
                throw new Error('Failed to log in');
            });
    }

    logout()
    {
        this._configRegistry.clear('auth', 'token');
    }

    postInternal(path, data)
    {
        return this._rawRequest('POST', INTERNAL_URL, path, data);
    }

    getInternal(path)
    {
        return this._rawRequest('GET', INTERNAL_URL, path);
    }

    post(path, data)
    {
        return this._rawRequest('POST', BASE_URL, path, data);
    }

    get(path)
    {
        return this._rawRequest('GET', BASE_URL, path);
    }

    delete(path, data)
    {
        return this._rawRequest('DELETE', BASE_URL, path, data);
    }

    _rawRequest(method, baseUrl, path, data)
    {
        var options = {
            method: method,
            uri: baseUrl + path,
            body: data,
            json: true
        };

        var token = this._configRegistry.get('auth', 'token');
        if (token) {
            options.headers = {
                'Authorization': token
            }
        }

        this._logger.verbose('RAW REQUEST:', options);
        return request(options)
            .then(result =>  {
                this._logger.verbose('RESPONSE:', result);
                return result;
            })
            .catch(err => {
                this._logger.error('RESPONSE ERROR:', err.message);
                this._logger.error('URL: %s', options.uri);
                this._logger.error('ALL OPTIONS: ', options);
                this._logger.exception(err);
                throw err;
            });
    }
}

module.exports = BerliozClient;
