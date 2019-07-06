class AccountDataProvider
{
    constructor(client)
    {
        this._client = client;
    }

    getDeployments()
    {
        return this._client.getMaster('/deployment');
    }

    getDeployment(name)
    {
        return this._client.getMaster(`/deployment/${name}`);
    }

    getProviders()
    {
        return this._client.getMaster('/provider');
    }

    getProvider(name)
    {
        return this._client.getMaster(`/provider/${name}`);
    }

    publishClusterDeploymentData(region, data)
    {
        return this._client.post(region, '/cluster-deployment-data/setup', data);
    }
}

module.exports = AccountDataProvider;