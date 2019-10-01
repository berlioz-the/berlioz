const fs = require('fs');
const Path = require('path');
const FindFiles = require('file-scanner');
const _ = require('the-lodash');

const IGNORE_DIRS = [
    '.git',
    'node_modules'
]

class Extractor {
    constructor(logger, rootDir, ignoredirs) {
        this._logger = logger.sublogger('Extractor');
        require('./logger').logger = logger;
        this._rootDir = rootDir;

        var finalIgnoreDirs = _.clone(IGNORE_DIRS);
        if (ignoredirs) {
            finalIgnoreDirs = _.concat(finalIgnoreDirs, ignoredirs);
        }
        this._ignoreDirMap = _.makeDict(finalIgnoreDirs, x => x, x => true);

        this._logger.info("IgnoreDirMap: ", this._ignoreDirMap);
    }

    perform(matchCb, errorCb) {
        return new Promise((resolve, reject) => {
            var results = [];

            this._logger.info("Started: %s", this._rootDir);

            var finder = new FindFiles({
                rootFolder : this._rootDir,
                filterFunction: (path, stat, name) => {
                    if (stat.isDirectory()) {
                        return false;
                    }
                    this._logger.debug("[filterFunction] %s", path);
                    return (name === 'Berliozfile') || (_.endsWith(name, '.Berliozfile'))
                },
                canGoDeepFunction: (path, stat, name) => {
                    if (name in this._ignoreDirMap) {
                        return false;
                    }
                    if (_.startsWith(name, '.')) {
                        return false;
                    }
                    return true;
                }
            });

            finder.on("match", (strPath, stat) => {
                this._logger.info("Matched: %s", strPath);

                if (matchCb) {
                    matchCb(strPath);
                }
                results.push(strPath);
            })
            finder.on("skip", (strPath) => {
                this._logger.info("Skipped: %s", strPath);
            })
            finder.on("complete", () => {
                resolve(results);
            })
            finder.on("patherror", (err, strPath) => {
                this._logger.warn("Error for Path: %s", strPath, err);
                // this._logger.exception(err);
                if (errorCb) {
                    errorCb(err, strPath);
                } else {
                    this._logger.exception(err);
                }
            })
            finder.on("error", (err) => {
                this._logger.error("Global Error", err);
                reject(err);
            })
            finder.startSearch();
        });
    }
}

module.exports = Extractor;
