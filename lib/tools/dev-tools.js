const FindFiles = require('../external/node-find-files/lib/node-find-files');
const Path = require('path');
const Promise = require('the-promise');
const spawn = require('cross-spawn');

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
            path => {
                var dirname = Path.basename(path);
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
            .then(projects => Promise.serial(projects, x => this._executeInProject(x, command)));
    }

    _executeInProject(proj, command)
    {
        this._logger.info('[_executeInProject] %s> %s', proj, command);

        var result = spawn.sync(command, { cwd: proj, shell: true, stdio: 'inherit' });
        this._logger.info('EXIT CODE: %s', result.status);
        if (result.status != 0) {
            this._logger.error('ERROR IN COMMAND');
        }
    }

    _findFiles(fileName, matchCb, filterDirectoryCb) {
        return new Promise((resolve, reject) => {
            var results = [];

            var finder = new FindFiles({
                rootFolder : this._rootDir,
                filterFunction : (path, stat) => {
                    if (!fileName) {
                        return true;
                    }
                    var name = Path.basename(path);
                    return name === fileName;
                },
                filterDirectory: filterDirectoryCb
            });

            finder.on("match", (strPath, stat) => {
                if (matchCb) {
                    matchCb(strPath);
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
