const _ = require('the-lodash');
const Promise = require('the-promise');
const Errors = require('./errors');

class CheckRunner
{
    constructor(logger, screen)
    {
        this._logger = logger;
        this._screen = screen;
        this._checks = {};
        this._runbook = [];
    }

    submit(name, info)
    {
        info = _.clone(info);
        info.name = name;
        if (!info.dependencies) {
            info.dependencies = [];
        }

        info.status = 'idle';
        info.error = null;
        info.isFailed = false;
        this._checks[name] = info;
        this._runbook.push(name);
    }

    run()
    {
        this._logger.info('Running checker...');
        
        this._pendingChecks = _.clone(this._runbook);
        return Promise.resolve()
            .then(() => this._next())
            .then(() => this.output())
            .then(() => {
                if (_.some(this._checks, x => x.isFailed)) {
                    throw new Errors.Generic("Validation failed");
                }
                this._screen.info("All checks passed.");
            })
            ;
    }

    output()
    {
        var checks = this._runbook.map(x => this._checks[x]);
        checks = checks.filter(x => x.status != 'skipped');

        this._screen.table()
            .autofitColumn('Name')
            .autofitColumn('Status')
            .column('Description')
        .addRange(checks, info => {
            return [info.name, info.status, info.description];
        })
        .output();

        var errorList = [];
        for(var name of this._runbook)
        {
            var info = this._checks[name];
            if (info.isFailed || info.isUnqualified) {
                errorList.push([info.name, info.solution]);
            }
        }
        if (errorList.length > 0)
        {
            this._screen.header("DETAILS")
            this._screen.table()
                .autofitColumn('Name')
                .column('Solution')
            .addRange(errorList)
            .output();
        }
    }

    _next()
    {
        if (this._pendingChecks.length == 0) {
            return;
        }
        var name = _.head(this._pendingChecks);
        this._logger.info('Checking %s...', name);

        this._pendingChecks = _.drop(this._pendingChecks);
        var info = this._checks[name];
        info.status = 'running';

        for(var x of info.dependencies)
        {
            if (this._checks[x].status != 'success')
            {
                info.status = 'skipped';
                info.error = 'Dependency failed.';
                return this._next();
            }
        }

        return Promise.resolve()
            .then(() => {
                return this._precheck(info)
                .then(precheckResult => {
                    if (precheckResult) {
                        return this._check(info)
                            .then(result => {
                                this._logger.info(result);
                                info.status = 'success';
                            })
                    } else {
                        info.isUnqualified = true;
                        info.status = 'unqualified';
                    }
                })
            })
            .catch(reason => {
                this._logger.warn(reason);

                info.status = 'failed';
                info.isFailed = true;
                info.error = reason.message;
                if (info.solutionCb) {
                    info.solution = info.solutionCb(reason);
                } else {
                    if (info.url) {
                        info.solution = reason.message + ' See details at: ' + info.url;
                    } else {
                        info.solution = reason.message;
                    }
                }
            })
            .then(() => this._next());
    }

    _precheck(info)
    {
        if (!info.precheck) {
            return Promise.resolve(true);
        }

        return Promise.resolve(info.precheck()) ;
    }

    _check(info)
    {
        if (!info.checkCb) {
            return Promise.resolve(true);
        }

        return Promise.resolve(info.checkCb()) ;
    }
}

module.exports = CheckRunner;