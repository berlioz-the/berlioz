const Path = require('path');
const FindFiles = require("node-find-files");
const _ = require('the-lodash');

module.exports = function(logger, rootFolder)
{
    return new Promise((resolve, reject) => {
        var results = [];

        var commonFolder = Path.resolve(__dirname, '..');
        logger.verbose('Extracing commands from %s...', rootFolder);

        var finder = new FindFiles({
            rootFolder: rootFolder,
            filterFunction: (path, stat) => {
                var name = Path.basename(path);
                return name === 'index.js';
            }
        });

        finder.on("match", (strPath, stat) => {
            strPath = _.replace(strPath, /\\/g, '/');
            var relPath = strPath.substring(rootFolder.length + 1);
            var command = relPath.split('/');
            command.splice(command.length - 1);
            results.push({
                dirPath: Path.dirname(strPath),
                fullPath: strPath,
                includePath: strPath,
                relPath: relPath,
                command: command
            });
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
