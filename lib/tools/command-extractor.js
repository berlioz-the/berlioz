const Path = require('path');
const FindFiles = require('file-scanner');
const _ = require('the-lodash');

module.exports = function(logger, rootFolder, matchCb)
{
    return new Promise((resolve, reject) => {
        var results = [];

        var commonFolder = Path.resolve(__dirname, '..');
        logger.verbose('Extracting commands from %s...', rootFolder);

        var finder = new FindFiles({
            rootFolder: rootFolder,
            filterFunction: (path, stat, name) => {
                return name === 'index.js';
            }
        });

        finder.on("match", (strPath, stat) => {
            strPath = _.replace(strPath, /\\/g, '/');
            var relPath = strPath.substring(rootFolder.length + 1);
            var command = relPath.split('/');
            command.splice(command.length - 1);
            var cmdObj = {
                dirPath: Path.dirname(strPath),
                fullPath: strPath,
                includePath: strPath,
                relPath: relPath,
                command: command,
                name: command.join(' '),
            };
            cmdObj.descrPath = Path.join(cmdObj.dirPath, 'description');
            if (matchCb) {
                matchCb(cmdObj);
            }
            results.push(cmdObj);
        })
        finder.on("complete", () => {
            resolve(results);
        })
        finder.on("patherror", (err, strPath) => {
            // this._logger.error("Error for Path: %s", strPath, err);
            // this._logger.exception(err);
        })
        finder.on("error", (err) => {
            // this._logger.error("Global Error", err);
            reject(err);
        })
        finder.startSearch();
    });
}
