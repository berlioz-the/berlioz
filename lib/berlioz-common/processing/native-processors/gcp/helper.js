const _ = require('the-lodash');

class GcpHelper
{
    constructor(args)
    {
        this._args = args;
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
}

module.exports = GcpHelper;
