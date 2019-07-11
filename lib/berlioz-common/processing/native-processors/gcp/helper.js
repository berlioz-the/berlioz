const Promise = require('the-promise');
const _ = require('the-lodash');
const DateDiff = require('date-diff');

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

    get screen() {
        return this.helper.screen;
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

    get gcpCriticalServiceAPIs() {
        return this.scope.gcpCriticalServiceAPIs;
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
        var context = {
            toEnable: {},
            toWait: {},
            operationMap: {},
            operationsToWait: {},
            waitUntil: new Date()
        }
        var apisToEnable = []
        if (this.gcpMandatoryServiceAPIs) {
            apisToEnable = _.concat(apisToEnable, this.gcpMandatoryServiceAPIs)
        }
        if (this.gcpCriticalServiceAPIs) {
            apisToEnable = _.concat(apisToEnable, this.gcpCriticalServiceAPIs)
            context.toWait = _.makeDict(this.gcpCriticalServiceAPIs, x => x, x => true);
        }
        context.toEnable = _.makeDict(apisToEnable, x => x, x => true);
        return Promise.serial(_.keys(context.toEnable), x => this._enableMandatoryAPI(x, context))
            .then(() => this._processPostApiEnable(context))
            .then(() => {
                this._logger.info('[_enableMandatoryAPIs] final wait until: %s', context.waitUntil);
                var diff = new DateDiff(context.waitUntil, new Date());
                var milliseconds = 1000 * diff.seconds();
                if (milliseconds > 0) 
                {
                    this._logger.info('[_enableMandatoryAPIs] final wait %sms...', milliseconds);
                    return Promise.timeout(milliseconds);
                }
            })
            ;
    }

    _processPostApiEnable(context)
    {
        this._logger.info("[_processPostApiEnable] OperationsToWait:", context.operationsToWait);
        return Promise.resolve()
            .then(() => {
                return Promise.serial(_.keys(context.operationsToWait), x => {
                    return this.gcpClient.ServiceUsage.isOperationCompleted(x) 
                        .then(isCompleted => {
                            this._logger.info("[_processPostApiEnable] %s isCompleted = %s", x, isCompleted);
                            if (isCompleted) {
                                delete context.operationsToWait[x];
                            }
                        });
                })
            })
            .then(() => {
                if (_.keys(context.operationsToWait).length > 0) {
                    return Promise.timeout(1000)
                        .then(() => this._processPostApiEnable(context));
                }
            })
    }

    _enableMandatoryAPI(name, context)
    {
        this._logger.info("[_enableMandatoryAPI] %s...", name);
        return this.gcpClient.ServiceUsage.query(name)
            .then(result => {
                if (result.state != "ENABLED") {
                    this._logger.info('[_enableMandatoryAPI] Enabling %s...', name);
                    if (this.screen) {
                        this.screen.info('Enabling GCP %s API...', name);
                    }
                    return this.gcpClient.ServiceUsage.enable(name)
                        .then(result => {
                            context.operationMap[name] = result.name;
                            if (context.toWait) {
                                context.operationsToWait[result.name] = true;
                            } else {
                                var date = new Date();
                                date.setSeconds(date.getSeconds() + 5);
                                context.waitUntil = date;
                            }
                            this._logger.info('[_enableMandatoryAPI] Enable %s result:', name, result);
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
