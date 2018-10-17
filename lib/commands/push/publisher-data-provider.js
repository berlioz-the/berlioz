class PublisherDataProvider
{
    constructor(client, region)
    {
        this._client = client;
        this._region = region;
    }

    getDeployments()
    {
        return this._client.get(this._region, '/deployment');
    }

    getProviders()
    {
        return this._client.get(this._region, '/provider');
    }

    publishClusterDeploymentData(data)
    {
        return this._client.post(this._region, '/cluster-deployment-data/setup', data);
    }
}

module.exports = PublisherDataProvider;