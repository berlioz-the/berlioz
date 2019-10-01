const generate = require('nanoid/generate')
const dictionary = require('nanoid-dictionary');

module.exports = (section, logger, {Promise, _, helper, gcp, deployment, cluster, shortSourceRegion}) => {
    section
        .onQueryAll(() => {
            return gcp.Sql.queryAllInstances(getPrefix())
            .catch(reason => {
                if (reason.isApiNotEnabled) {
                    return [];
                }
                throw reason;
            });
        })
        .onExtractNaming(obj => getNaming(obj))
        .onExtractId(obj => obj.name)
        .onQuery(id => gcp.Sql.queryInstance(id))
        .onExtractConfig(obj => { 
            return {
                config: obj
            };
        })
        .onExtractRuntime(obj => {
            var runtime = {
                host: null
            };
            if (obj.ipAddresses) {
                var address = _.head(obj.ipAddresses.filter(x => x.type == 'PRIMARY'));
                if (address) {
                    runtime.host = address.ipAddress;
                }
            }
            return runtime;
        })
        .onCheckReady(item => {
            if (item.obj.state != "RUNNABLE") {
                return false;
            }
            if (!item.runtime.host) {
                return false;
            }
            return true;
        })
        .markUseDefaultsForDelta()
        .onCreate(delta => {
            var suffix = generate(dictionary.lowercase, 10);
            var name = delta.naming.join('-') + '-' + suffix;
            return gcp.Sql.createInstance(name, delta.config.config);
        })
        .onUpdate(delta => {
            var params = _.cloneDeep(delta.config.config);
            if (!params.settings) {
                params.settings = {}
            }
            params.settings.settingsVersion = delta.obj.settings.settingsVersion;
            return gcp.Sql.updateInstance(delta.id, params);
        })
        .onDelete(delta => {
            return gcp.Sql.deleteInstance(delta.id);
        })
        ;

    function getPrefixParts()
    {
        var prefixParts = [
            deployment,
            cluster,
            shortSourceRegion
        ]
        prefixParts = prefixParts.filter(x => _.isNotNullOrUndefined(x));
        return prefixParts;
    }

    function getPrefix()
    {
        var prefixParts = getPrefixParts();
        prefixParts.push('');
        var prefix = prefixParts.join('-');
        prefix = prefix.toLowerCase();
        logger.info("[SQL] QUERY prefix: %s", prefix);
        return prefix;
    }

    function getNaming(obj)
    {
        var naming = obj.name.split('-');
        naming = _.dropRight(naming);
        return naming;
    }
}
