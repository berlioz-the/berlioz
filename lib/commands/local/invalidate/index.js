
module.exports = {

    useLocalDeployer: true,

    exec: function({Promise, _, args, logger, screen, localDeployer, config}) {
        return localDeployer.invalidateAllClusters();
    }
}
