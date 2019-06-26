const Path = require('path');
const os = require('os');
const fs = require('fs');
const _ = require('the-lodash');
const Shell = require('./shell');

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

    writeToTmpConfigFile(fileName, keyContent)
    {
        var fullPath = this.getConfigDir(fileName);
        var dirName = Path.dirname(fullPath);
        this._shell.shell.mkdir('-p', dirName);
        fs.writeFileSync(fullPath, keyContent);
        return fullPath;
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
}

module.exports = Storage