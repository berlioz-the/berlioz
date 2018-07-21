const shell = require('rubenhak-shelljs');
const child_process = require('child_process');
const _ = require('the-lodash');
const Promise = require('the-promise');

class Shell
{
    constructor(logger, screen)
    {
        this._logger = logger;
        this._screen = screen;
    }

    get shell() {
        return shell;
    }

    run(command, envOverride) {
        return new Promise((resolve, reject) => {
            this._screen.info('$ %s', command)
            this._logger.info('RUNNING: %s', command);
            shell.exec(command, { async: true },
                (code, stdout, stderr) => {
                    var result = {
                        code: code, stdout: stdout, stderr: stderr
                    }
                    this._logger.info('EXIT CODE: %s', result.code);
                    if (result.code == 0) {
                        resolve(result);
                    }
                    else {
                        var errStr = 'ErrorCode: ' + result.code;
                        if (result.stderr) {
                            errStr = errStr + ' ERR: ' + result.stderr;
                        }
                        if (result.stdout) {
                            errStr = errStr + ' OUT: ' + result.stdout;
                        }
                        reject(errStr);
                    }
                });
        });
    }

    runX(command, workingDir)
    {
        return new Promise((resolve, reject) => {
            this._screen.info('$$ %s', command)
            this._logger.info('RUNNING-X: %s', command);
            child_process.exec(command, {cwd:workingDir}, (error, stdout, stderr) => {
                var result = {
                    stdout: stdout, stderr: stderr
                }
                if (error) {
                    result.code = error.status
                    var errStr = 'ErrorCode: ' + result.code;
                    if (result.stderr) {
                        errStr = errStr + ' ERR: ' + result.stderr;
                    }
                    if (result.stdout) {
                        errStr = errStr + ' OUT: ' + result.stdout;
                    }
                    this._logger.info('EXIT CODE: %s', result.code);
                    reject(errStr);
                } else {
                    this._logger.info('EXIT CODE: %s', result.code);
                    result.code = 0
                    resolve(result);
                }
            })
        });
    }

}

module.exports = Shell