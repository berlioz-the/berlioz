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

    login(username, password, region)
    {
        if (region) {
            return this._loginToRegion(username, password, region);
        } else {
            return this._performInMaster(x => {
                return this._loginToRegion(username, password, x);
            });
        }
    }

    _loginToRegion(username, password, region)
    {
        if (!region) {
            throw new Error('No region specified to login.');
        }

        return Promise.resolve()
            .then(() => this.logout(region))
            .then(() => this._requestToRegion(region, 'POST', SECTION_AAA, '/login', { username: username, password: password }, true))
            .then(result => this._handlePostLogin(region, result));
    }

    _refreshToken(refreshToken, region)
    {
        if (!region) {
            throw new Error('No region specified to login.');
        }

        return Promise.resolve()
            .then(() => this._requestToRegion(region, 'POST', SECTION_AAA, '/refresh', { refresh_token: refreshToken }, true))
            .then(result => this._handlePostLogin(region, result));
    }

    _handlePostLogin(region, result)
    {
        if (result) {
            if (result.success) {
                return Promise.resolve(this._resolveRegionBaseUrl(region))
                    .then(baseUrl => {
                        this._configRegistry.set('auth', ['token', baseUrl], result);
                    })
                    .then(() => result);
            }
        }
        throw new Error('Failed to log in');
    }

    logout(region)
    {
        return Promise.resolve()
            .then(() => {
                if (region) {
                    return region;
                } else {
                    return this._getFromGlobal('masterRegion');
                }
            })
            .then(myRegion => Promise.resolve(this._resolveRegionBaseUrl(myRegion)))
            .then(baseUrl => {
                return this._configRegistry.clear('auth', ['token', baseUrl]);
            })
    }

    preSignup(data)
    {
        return this._performInMaster(region => {
            return this._requestToRegion(region, 'POST', SECTION_AAA, '/presignup', data);
        })
    }

    signup(data)
    {
        return this._performInMaster(region => {
            return this._requestToRegion(region, 'POST', SECTION_AAA, '/signup', data);
        })
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
    //////////////////////

    // _performRequest(method, baseSection, path, data, routingOptions)
    // {
    //     var regions = ['us-east-1', 'us-west-2'];
    //     var results = {};

    //     return Promise.serial(regions, region => {
    //         return this._requestToRegion(region, method, baseSection, path, data)
    //             .then(result => {
    //                 results[region] = result;
    //             })
    //     })
    //     .then(() => {
    //         return 
    //     })
    // }

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

    _requestToRegionX(region, method, baseUrl, targetUrl, path, data, canRefreshToken)
    {
        var tokenObj = this._configRegistry.get('auth', ['token', baseUrl]);
        if (!tokenObj || !tokenObj.id_token) {
            throw new Errors.Auth("Not logged in.");
        }
        return this._rawRequest(method, targetUrl, path, data, tokenObj.id_token)
            .catch(reason => {
                if (canRefreshToken) {
                    if (reason instanceof Errors.Auth) {
                        return this._refreshToken(tokenObj.refresh_token, region)
                            .then(() => this._requestToRegionX(region, method, baseUrl, targetUrl, path, data, false))
                    }
                }
                throw reason;
            });

    }

    _resolveRegionBaseUrl(region)
    {
        return Promise.resolve(this._getFromGlobal('regionMapping'))
            .then(regionMapping => {
                var baseUrl = regionMapping[region];
                if (!baseUrl) {
                    throw new Error('Region \"' + region + '\" not supported.');
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

        this._logger.verbose('RAW REQUEST:', options);
        return request(options)
            .then(result =>  {
                this._logger.verbose('RESPONSE:', result);
                return result;
            })
            .catch(err => {
                // this._logger.error('FAILED REQUEST:', options);
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
