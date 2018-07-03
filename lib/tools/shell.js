const shell = require('rubenhak-shelljs');
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

}

module.exports = Shell