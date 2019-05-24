const request = require('request-promise');
const _ = require('the-lodash');
const Errors = require('./errors');
const fs = require('fs');
const yaml = require('js-yaml');
const DateDiff = require('date-diff');

const SECTION_AAA = 'aaa';
const SECTION_API = 'v1';

class BerliozClient
{
    constructor(logger, screen, configRegistry)
    {
        this._screen = screen;
        this._endpoints = {
            global: 'https://api-global.berlioz.cloud/global'
        }

        if (process.env['BERLIOZ_ENDPOINT_OVERRIDE']) {
            var fileContentsStr = fs.readFileSync(process.env['BERLIOZ_ENDPOINT_OVERRIDE']);
            var fileContents = yaml.safeLoad(fileContentsStr);
            if (!fileContents.endpoints) {
                fileContents.endpoints = {};
            }
            this._endpoints = _.defaults(fileContents.endpoints, this._endpoints);
            screen.header('BERLIOZ ENDPOINTS OVERRIDDEN');
            for(var x of _.keys(this._endpoints)) {
                screen.info('EP: %s => %s', x, this._endpoints[x]);
            }
            screen.line();
        }

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
        this._shouldSkipSsl = false;
    }

    setSkipSSL(value)
    {
        this._shouldSkipSsl = value;
    }

    _queryRegions()
    {
        return this._rawRequest('GET', this._endpoints.global, '/regions')
            .then(data => {
                this._configRegistry.set('global', 'rawRegions', data);
                this._configRegistry.set('global', 'regionMapping', data.mapping);
                this._configRegistry.set('global', 'providerMapping', data.providers);
                this._configRegistry.set('global', 'masterRegion', data.masterRegion);
                this._configRegistry.set('global', 'lastCheck', new Date().toISOString());
                this._configRegistry.set('global', 'sourceEndpoints', this._endpoints);
            });
    }

    _fetchRegions()
    {
        if (!this._shouldRefreshRegions()) {
            return;
        }
        return this._queryRegions();
    }

    _shouldRefreshRegions()
    {
        var lastCheckStr = this._configRegistry.get('global', 'lastCheck');
        if (!lastCheckStr) {
            return true;
        }

        var sourceEndpoints = this._configRegistry.get('global', 'sourceEndpoints');
        if (!sourceEndpoints) {
            return true;
        }
        if (!_.fastDeepEqual(sourceEndpoints, this._endpoints)) {
            return true;
        }

        var lastCheck = new Date(lastCheckStr);
        var diff = new DateDiff(new Date(), lastCheck);
        if (diff.seconds() < 5 * 60) {
            return false;
        }

        return true;
    }

    _performInMaster(action)
    {
        return Promise.resolve(this._getFromGlobal('masterRegion'))
            .then(region => {
                if (!region) {
                    throw new Error('Master region not present. Please try again later.');
                }
                return action(region);
            });
    }

    login(username, password)
    {
        return Promise.resolve()
            .then(() => this.logout())
            .then(() => this.requestToAAA('POST', '/login', { user: username, pass: password }))
            .then(result => this._handlePostLogin(result));
    }

    _handlePostLogin(result)
    {
        if (result)
        {
            if (result.success)
            {
                this._configRegistry.set('auth', ['token', this._endpoints.global], result);
                return;
            }
        }
        throw new Error('Failed to log in');
    }

    _refreshToken(refreshToken)
    {
        return Promise.resolve()
            .then(() => this.requestToAAA('POST', '/refresh', { refresh_token: refreshToken }))
            .then(result => this._handlePostLogin(result));
    }

    logout()
    {
        return Promise.resolve()
            .then(() => {
                return this._configRegistry.clear('auth', ['token', this._endpoints.global]);
            })
    }

    requestToAAA(method, path, data)
    {
        return this._performInMaster(region => {
            return this._requestToRegion(region, method, SECTION_AAA, path, data, true)
        })
    }

    getRegions()
    {
        return Promise.resolve(this._getFromGlobal('providerMapping'))
            .then(result => {
                return _.keys(result).map(x => ({
                    name: x,
                    provider: result[x]
                }))
            });
    }

    //////////////////////////////////////
    post(region, path, data)
    {
        return this._requestToRegion(region, 'POST', SECTION_API, path, data);
    }

    postMaster(path, data)
    {
        return this._performInMaster(region => {
            return this.post(region, path, data);
        })
    }

    get(region, path)
    {
        return this._requestToRegion(region, 'GET', SECTION_API, path);
    }

    getMaster(path)
    {
        return this._performInMaster(region => {
            return this.get(region, path);
        })
    }

    delete(region, path, data)
    {
        return this._requestToRegion(region, 'DELETE', SECTION_API, path, data);
    }

    deleteMaster(path, data)
    {
        return this._performInMaster(region => {
            return this.delete(region, path, data);
        })
    }

    _requestToRegion(region, method, baseSection, path, data, skipAuth)
    {
        return Promise.resolve(this._resolveRegionBaseUrl(region))
            .then(baseUrl => {
                var targetUrl = baseUrl + '/' + baseSection;
                if (skipAuth)
                {
                    return this._rawRequest(method, targetUrl, path, data, null);
                }
                else 
                {
                    return this._requestToRegionX(region, method, baseUrl, targetUrl, path, data, true);
                }
            });
    }

    _requestToRegionX(region, method, baseUrl, targetUrl, path, data, tryRefreshToken)
    {
        var tokenObj = this._configRegistry.get('auth', ['token', this._endpoints.global]);
        if (!tokenObj || !tokenObj.access_token) {
            throw new Errors.Auth("Not logged in.");
        }
        return this._rawRequest(method, targetUrl, path, data, tokenObj.access_token)
            .catch(reason => {
                if (tryRefreshToken) {
                    if (reason instanceof Errors.Auth) {
                        return this._refreshToken(tokenObj.refresh_token)
                            .then(() => this._requestToRegionX(region, method, baseUrl, targetUrl, path, data, false))
                    }
                }
                throw reason;
            });
    }

    _resolveRegionBaseUrl(region)
    {
        if (!region) {
            throw new Error("Region not set!")
        }
        return Promise.resolve(this._getFromGlobal('regionMapping'))
            .then(regionMapping => {
                var baseUrl = regionMapping[region];
                if (!baseUrl) {
                    throw new Error(`Region \"${region}\" not supported.`);
                }
                return baseUrl;
            });
    }

    _getFromGlobal(name)
    {
        return Promise.resolve(this._fetchRegions())
            .then(() => this._configRegistry.get('global', name));
    }

    _rawRequest(method, baseUrl, path, data, token)
    {
        var options = {
            method: method,
            uri: baseUrl + path,
            body: data,
            json: true
        };

        if (this._shouldSkipSsl) {
            options.strictSSL = false;
        }

        if (token) {
            options.headers = {
                'Authorization': token
            }
        }

        this._logger.info('RAW REQUEST:', options);
        return request(options)
            .then(result =>  {
                this._logger.info('RESPONSE:', result);
                return result;
            })
            .catch(err => {
                // this._logger.error('FAILED REQUEST:', options);
                this._logger.info('ERROR:', err);
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
        // this._logger.error('[_massageErrorResponse]', response);
        // this._logger.error('[_massageErrorResponse] statusCode: %s', response.statusCode);
        if (response)
        {
            if (response.statusCode == 401 || response.statusCode == 403)
            {
                var msg = this._getErrorFromResponse(response);
                throw new Errors.Auth(msg);
            }

            if (response.statusCode == 400)
            {
                var msg = this._getErrorFromResponse(response);
                throw new Errors.Input(msg);
            }

            this._logger.error('RESPONSE ERROR MSG: ', response.error);
            this._logger.error('RESPONSE STATUS CODE: %s', response.statusCode);
            this._logger.error('RESPONSE CODE: %s', response.code);
            
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
