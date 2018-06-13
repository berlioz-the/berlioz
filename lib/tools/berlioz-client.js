const request = require('request-promise');
const Errors = require('./errors');

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
        return this._rawRequest('POST', AAA_BASE_URL, '/login', { username: username, password: password })
            .then(result => {
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

    preSignup(data)
    {
        return this._rawRequest('POST', AAA_BASE_URL, '/presignup', data);
    }

    signup(data)
    {
        return this._rawRequest('POST', AAA_BASE_URL, '/signup', data);
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
                this._logger.verbose('ERROR:', err);
                this._massageErrorResponse(err);
                this._logger.error('RESPONSE ERROR: %s', err.message);
                this._logger.error('URL: %s', options.uri);
                this._logger.error('ALL OPTIONS: ', options);
                this._logger.exception(err);
                throw err;
            });
    }

    _massageErrorResponse(response)
    {
        if (response)
        {
            if (response.statusCode == 401)
            {
                var msg = this._getErrorFromResponse(response);
                throw new Errors.Auth(msg);
            }

            if (response.statusCode == 400)
            {
                var msg = this._getErrorFromResponse(response);
                throw new Errors.Input(msg);
            }

            this._logger.error('RESPONSE STATUS CODE: %s', response.statusCode);
            this._logger.error('RESPONSE ERROR: ', response.error);

            this._logger.error('Please contact support@berlioz.cloud for help.');
        }
    }

    _getErrorFromResponse(response)
    {
        if (response)
        {
            if (response.error)
            {
                if (response.error.message) {
                    return response.error.message;
                }
                if (response.error.error) {
                    return response.error.error;
                }
                this._logger.error('RESPONSE ERROR: ', response.error);
            }
        }
        return 'Unknown error. Please refer to logs or contact support@berlioz.cloud.';
    }
}

module.exports = BerliozClient;
