const Promise = require('the-promise');
const _ = require('the-lodash');

class GcpHelper
{
    constructor(logger, args)
    {
        this._logger = logger;
        this._args = args;
        this._logger.info('[constructor] args: ', _.keys(this._args));
        this._logger.info('[constructor] scope: ', _.keys(this._args.scope));
    }

    get helper() {
        return this._args.helper;
    }
    
    get currentConfig() {
        return this.helper._currentConfig;
    }

    get config() {
        return this.helper._desiredConfig;
    }

    get scope() {
        return this._args.scope;
    }

    get gcpMandatoryServiceAPIs() {
        return this.scope.gcpMandatoryServiceAPIs;
    }

    get gcpClient() {
        return this.scope.gcp;
    }

    get metaContext() {
        return this.scope.metaContext;
    }

    init()
    {
        return Promise.resolve()
            .then(() => this._enableMandatoryAPIs())
            .then(() => this._fetchProjectNumber())
    }

    constructConfig()
    {
        if (!this.currentConfig) {
            return;
        }
        return this.config.section('gcp-service-api').cloneFrom(this.currentConfig);
    }

    registerGcpApiDependency(item, apiName)
    {
        var naming = [apiName];
        return Promise.resolve()
            .then(() => {
                var serviceApiItem = this.config.find('gcp-service-api', naming);
                if (serviceApiItem) {
                    return serviceApiItem;
                }
                return this.config.section('gcp-service-api').create(naming);
            })
            .then(serviceApiItem => {
                serviceApiItem.setConfig('enabled', true);
                return item.relation(serviceApiItem)
                    .then(rel => rel.markIgnoreDelta());
            })
    }

    _enableMandatoryAPIs()
    {
        if (!this.gcpMandatoryServiceAPIs) {
            return;
        }
        return Promise.serial(this.gcpMandatoryServiceAPIs, x => this._enableMandatoryAPI(x))
    }

    _enableMandatoryAPI(name)
    {
        this._logger.info("[_enableMandatoryAPI] %s...", name);
        return this.gcpClient.ServiceUsage.query(name)
            .then(result => {
                if (result.state != "ENABLED") {
                    this._logger.info('[_enableMandatoryAPI] Enabling %s...', name);
                    return this.gcpClient.ServiceUsage.enable(name)
                        .then(result => {
                            this._logger.info('[_enableMandatoryAPI] Enable %s result. Pausing for a moment.', name, result);
                            return Promise.timeout(5000);
                        });
                } else {
                    this._logger.info('[_enableMandatoryAPI] Was already enabled %s...', name);
                }
            })
    }

    _fetchProjectNumber()
    {
        return Promise.resolve()
            .then(() => this.gcpClient.getProjectNumber())
            .then(result => {
                this._logger.info('[_fetchProjectNumber] gcpProjectNumber = %s', result);
                this.scope.gcpProjectNumber = result;
                this.metaContext.gcpProjectNumber = result;
            })
    }
}

module.exports = GcpHelper;
