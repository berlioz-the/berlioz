class PublisherDataProvider
{
    constructor()
    {
    }

    getDeployments()
    {
        return Promise.resolve();
    }

    getProviders()
    {
        return Promise.resolve();
    }

    publishClusterData(data)
    {
        // console.log(JSON.stringify(data, null, 2));
        return Promise.resolve();
    }

    publishClusterDeploymentData(region, data)
    {
        // console.log(JSON.stringify(data, null, 2));
        return Promise.resolve();
    }
}

module.exports = PublisherDataProvider;