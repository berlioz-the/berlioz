const FindFiles = require('file-scanner');
const Path = require('path');
const Promise = require('the-promise');
const spawn = require('cross-spawn');
const wildcard = require('wildcard');

class DevTools
{
    constructor(logger, rootDir)
    {
        this._logger = logger;
        this._rootDir = rootDir;
    }

    findNpmProjects()
    {
        return this._findFiles('package.json', null,
            (path, stat, dirname) => {
                if (dirname == 'node_modules') {
                    return false;
                }
                return true;
            })
            .then(results => {
                return results.map(x => Path.dirname(x));
            });
    }

    executeInNpmProjects(command)
    {
        return this.findNpmProjects()
            .then(projects => Promise.serial(projects, x => this.execute(x, command)));
    }

    execute(dir, command)
    {
        this._logger.info('[execute] %s> %s', dir, command);

        var result = spawn.sync(command, { cwd: dir, shell: true, stdio: 'inherit' });
        this._logger.info('EXIT CODE: %s', result.status);
        if (result.status != 0) {
            this._logger.error('ERROR IN COMMAND');
        }
    }

    findFiles(fileNamePattern, matchCb)
    {
        return this._findFiles(fileNamePattern, matchCb, null);
    }

    _findFiles(fileNamePattern, matchCb, filterDirectoryCb) {
        return new Promise((resolve, reject) => {
            var results = [];

            var finder = new FindFiles({
                rootFolder : this._rootDir,
                filterFunction : (path, stat, name) => {
                    if (!fileNamePattern) {
                        return true;
                    }
                    return wildcard(fileNamePattern, name);
                },
                canGoDeepFunction: filterDirectoryCb
            });

            finder.on("match", (strPath, stat) => {
                if (matchCb) {
                    var name = Path.basename(strPath);
                    var dir = Path.dirname(strPath);
                    matchCb(strPath, name, dir);
                }
                results.push(strPath);
            })
            finder.on("complete", () => {
                resolve(results);
            })
            finder.on("patherror", (err, strPath) => {
                this._logger.error("Error for Path: %s", strPath, err);
                this._logger.exception(err);
            })
            finder.on("error", (err) => {
                this._logger.error("Global Error", err);
                reject(error);
            })
            finder.startSearch();
        });
    }
}

module.exports = DevTools;
