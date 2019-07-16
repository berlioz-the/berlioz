const _ = require('the-lodash');
const Promise = require('the-promise');
const DateDiff = require('date-diff');

class Waiter
{
    constructor(logger, screen, client, isEnabled, timeout)
    {
        this._logger = logger;
        this._screen = screen;
        this._client = client;
        this._isEnabled = isEnabled;
        this.timeoutSec = 0;
        if (timeout) {
            this.timeoutSec = parseInt(timeout);
        }
    }

    perform(waitTarget)
    {
        if (!this._isEnabled) {
            return;
        }
        this._startDate = Date.now();
        return this._checkIfReady(waitTarget);
    }

    _checkIfReady(waitTarget)
    {
        return this._client.post(waitTarget.region, '/deployment-clusters/status', waitTarget)
            .then(result => {
                this._screen.table([
                    'Deployment', 
                    'Cluster', 
                    'Region', 
                    'Desired State', 
                    'Status'
                ])
                .addRange(result, x => [
                    x.deployment, 
                    x.cluster, 
                    x.region, 
                    x.state, 
                    x.userStatus
                ])
                .output();

                if (_.some(result, x => x.status == 'processing')) {
                    var diff = new DateDiff(Date.now(), this._startDate);
                    if (this.timeoutSec) {
                        if (diff.seconds() > this.timeoutSec) {
                            throw new Error('Process did not finish within ' + this.timeoutSec + ' seconds.');
                        } 
                    }
                    this._screen.info('Past %s seconds, waiting...', diff.seconds())
                    return Promise.timeout(10 * 1000)
                        .then(() => this._checkIfReady(waitTarget))
                } else {
                    this._screen.info('Deployment completed.')
                }
            });
    }
}

module.exports = Waiter;