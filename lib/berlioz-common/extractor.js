const fs = require('fs');
const Path = require('path');
const FindFiles = require('node-find-files');

class Extractor {
    constructor(logger, rootDir) {
        this._logger = logger;
        this._rootDir = rootDir;
    }

    perform(matchCb) {
        return new Promise((resolve, reject) => {
            var results = [];

            var finder = new FindFiles({
                rootFolder : this._rootDir,
                filterFunction : (path, stat) => {
                    var name = Path.basename(path);
                    return name === 'Berliozfile';
                }
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

module.exports = Extractor;
