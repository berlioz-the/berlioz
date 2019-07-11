module.exports = (section, logger, {Promise, _, helper, gcp, deployment, cluster, region}) => {
    section
        .priority(1)
        .onQueryAll(() => {
            var apiNames = helper.getGcpServiceAPIs();
            if (!apiNames) {
                return [];
            }
            return Promise.serial(apiNames, x => query(x));
        })
        .onExtractNaming(obj => getNaming(obj))
        .onExtractId(obj => getNaming(obj))
        .onQuery(id => query(id))
        .onExtractConfig(obj => { 
            return {
                enabled: obj.state == "ENABLED"
            };
        })
        .onUpdate(delta => {
            if (delta.config.enabled) {
                return gcp.ServiceUsage.enable(delta.id)
                    .then(() => {
                        logger.info("Enabled GCP API %s. Pausing a bit...", delta.id);
                        return Promise.timeout(15000);
                    });
            }
        })
        .onDelete(() => {

        })
        ;

    function getNaming(obj)
    {
        var name = obj.config.name;
        return name;
    }

    function query(id)
    {
        return gcp.ServiceUsage.query(id)
            .then(result => {
                if (result) {
                    if (result.config) {
                        if (result.config.apis) {
                            delete result.config.apis;
                        }
                        if (result.config.quota) {
                            delete result.config.quota;
                        }
                        if (result.config.authentication) {
                            delete result.config.authentication;
                        }
                        if (result.config.usage) {
                            delete result.config.usage;
                        }
                        if (result.config.endpoints) {
                            delete result.config.endpoints;
                        }
                        if (result.config.documentation) {
                            delete result.config.documentation;
                        }
                    }
                }
                return result;
            })
    }
}
