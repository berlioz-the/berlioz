const Path = require('path');
const os = require('os');
const fs = require('fs');
const _ = require('the-lodash');
const Shell = require('./shell');
const FindFiles = require('file-scanner');
const Promise = require('the-promise');

class Storage
{
    constructor(logger, screen)
    {
        this._logger = logger;
        this._screen = screen;
        this._shell = new Shell(logger, screen);
    }
    
    getConfigRoot()
    {
        return Path.resolve(os.homedir(), '.berlioz');
    }

    getConfigDir(dir)
    {
        return Path.resolve(this.getConfigRoot(), dir);
    }

    readConfigFile(fileName)
    {
        var filePath = this.getConfigDir(fileName);
        this._logger.info('[readConfigFile] trying to load from %s..', filePath)
        if (fs.existsSync(filePath)) {
            var fileContentsStr = fs.readFileSync(filePath);
            return fileContentsStr;
        }
        return null;
    }
    
    writeConfigFile(fileName, content)
    {
        var fullPath = this.getConfigDir(fileName);
        var dirName = Path.dirname(fullPath);
        this.sanitizePath(dirName)
        fs.writeFileSync(fullPath, content);
        return fullPath;
    }
    
    writeToTmpConfigFile(fileName, content)
    {
        return this.writeConfigFile(fileName, content);
    }

    readConfigDir(path)
    {
        var fullDir = this.getConfigDir(path);
        return this.findFiles(fullDir)
            .then(result => {
                return result;
            })
    }

    readFromFile(filePath)
    {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
            });
        });
    }

    sanitizePath(directory)
    {
        this._shell.shell.mkdir('-p', directory);
        return directory;
    }

    writeToFile(filePath, contents)
    {
        this._logger.info('[writeToFile] %s..', filePath)
        return new Promise((resolve, reject) => {
            var dirName = Path.dirname(filePath);
            this.sanitizePath(dirName);
            fs.writeFile(filePath, contents, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    deleteFile(filePath)
    {
        this._logger.info('[deleteFile] %s..', filePath)
        return new Promise((resolve, reject) => {
            fs.unlink(filePath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    deleteDirectory(dirPath)
    {
        this._logger.info('[deleteDirectory] %s..', dirPath)
        return this._shell.shell.rm('-rf', dirPath)
    }

    listDirectories(parent)
    {
        if (!fs.existsSync(parent)) {
            return [];
        }

        return fs.readdirSync(parent, { withFileTypes: true })
            .filter(dir => dir.isDirectory())
            .map(dir => ({
                full_path: Path.resolve(parent, dir.name),
                name: dir.name
            }));
    }

    findFiles(dir) {
        return new Promise((resolve, reject) => {
            var results = [];

            this._logger.info("Started Find: %s", dir);

            if (!fs.existsSync(dir)) {
                resolve([]);
                return;
            }

            var finder = new FindFiles({
                rootFolder : dir,
                filterFunction: (path, stat, name) => {
                    if (stat.isDirectory()) {
                        return false;
                    }
                    return true;
                    // this._logger.debug("[filterFunction] %s", path);
                    // return (name === 'Berliozfile') || (_.endsWith(name, '.Berliozfile'))
                },
                canGoDeepFunction: (path, stat, name) => {
                    return true;
                }
            });

            finder.on("match", (strPath, stat) => {
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
                this._logger.exception(err);
            })
            finder.on("error", (err) => {
                this._logger.error("Global Error", err);
                reject(err);
            })
            finder.startSearch();
        });
    }

    readDirWithContents(dir, options)
    {
        options = options || {};
        return this.findFiles(dir)
        .then(fileNames => {
            var result = {};
            return Promise.serial(fileNames, x => {
                return this.readFromFile(x)
                    .then(contents => {
                        var key = x;
                        if (options.excludeParentDir) {
                            key = key.substring(dir.length);
                            while (key.startsWith("\\") || key.startsWith("/")) {
                                key = key.substring(1);
                            }
                            key = key.replace(/\\/g, '/');
                        }
                        result[key] = contents;
                    })
            })
            .then(() => result);
        })
    }

    syncDirectory(rootDir, changes)
    {
        return Promise.serial(changes, x => {
            var full_path = Path.join(rootDir, x.item);
            if (x.present) {
                return this.writeToFile(full_path, x.contents)
            } else {
                return this.deleteFile(full_path)
            }
        });
    }
}

module.exports = Storage