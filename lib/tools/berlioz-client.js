const request = require('request-promise');
const _ = require('the-lodash');
const Errors = require('./errors');
const YAML = require('yamljs');
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
            var fileContents = YAML.load(process.env['BERLIOZ_ENDPOINT_OVERRIDE']);
            if (!fileContents.endpoints) {
                fileContents.endpoints = {};
            }
            this._endpoints = _.defaults(fileContents.endpoints, this._endpoints);
            screen.header('BERLIOZ ENDPOINTS OVERRIDDED');
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
    }

    _queryRegions()
    {
        return this._rawRequest('GET', this._endpoints.global, '/regions')
            .then(data => {
                this._configRegistry.set('global', 'rawRegions', data);
                this._configRegistry.set('global', 'regionMapping', data.mapping);
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
            })
        }
    }

    _loginToRegion(username, password, region)
    {
        if (!region) {
            throw new Error('No region specified to login.');
        }

        this.logout(region);
        return this._requestToRegion(region, 'POST', SECTION_AAA, '/login', { username: username, password: password })
            .then(result => {
                if (result) {
                    if (result.success) {
                        this._configRegistry.set('auth', ['token', region], result.id_token);
                        return result;
                    }
                }
                throw new Error('Failed to log in');
            });
    }

    logout(region)
    {
        var accessPath = ['token'];
        if (region) {
            accessPath.push(region);
        }
        this._configRegistry.clear('auth', accessPath);
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

    _requestToRegion(region, method, baseSection, path, data)
    {
        return Promise.resolve(this._getFromGlobal('regionMapping'))
            .then(regionMapping => {
                var baseUrl = regionMapping[region];
                if (!baseUrl) {
                    throw new Error('Region \"' + region + '\" not supported.');
                }
                baseUrl += '/' + baseSection;
        
                var token = this._configRegistry.get('auth', ['token', region]);
                return this._rawRequest(method, baseUrl, path, data, token);
            })
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
                // console.log("*********************************")
                // console.log(options)
                // console.log("*********************************")
                // console.log(err)
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
