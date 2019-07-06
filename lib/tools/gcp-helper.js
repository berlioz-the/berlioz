const fs = require('fs');
const Path = require('path');
const _ = require('the-lodash');
const Promise = require('the-promise');
const GcpSdkClient = require('berlioz-gcp-sdk');

class GcpHelper
{
    constructor(logger, screen, shell)
    {
        this._logger = logger;
        this._screen = screen;
        this._shell = shell;
    }

    get logger() {
        return this._logger;
    }

    get screen() {
        return this._screen;
    }

    get shell() {
        return this._shell;
    }

    queryProvider(deploymentName)
    {

    }

    _queryDeployment(name)
    {
        return this._dataProvider.getDeployments()
            .then(result => {
                this._deployments = {};
                for(var x of result) {
                    if (this._targetDeployment) {
                        if (this._targetDeployment != x.name) {
                            continue;
                        }
                    }
                    this._deployments[x.name] = x;
                }
                this._logger.info('DEPLOYMENTS: ', this._deployments);
            });
    }

}

module.exports = GcpHelper;