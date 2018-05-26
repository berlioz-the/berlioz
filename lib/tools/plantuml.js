const ChildProcess = require('child-process-promise');
const _ = require('the-lodash');
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const StringBuilder = require('stringbuilder');
const chromeLauncher = require('chrome-launcher');

class PlantUml
{
    constructor(logger)
    {
        this._logger = logger;
        this._plantUmlPath = path.join(path.dirname(__dirname), 'external', 'plantuml', 'plantuml.jar');
        this._workingDir = tmp.dirSync().name;
        this._sb = new StringBuilder();
        this.write('@startuml');
    }

    write(str)
    {
        this._sb.appendLine(str);
    }

    renderToScreen()
    {
        return this.render('txt')
            .then(filePath => {
                this._logger.info('filePath: %s', filePath);
                var contentsBuf = fs.readFileSync(filePath);
                var contents = contentsBuf.toString('utf8');
                this._logger.info('contents: %s', contents);
            });
    }

    renderToImage(destDir)
    {
        return this.render('png', destDir);
    }

    renderToTempImage()
    {
        return this.render('png')
            .then(filePath => {
                return chromeLauncher.launch({
                    startingUrl: filePath
                }).then(chrome => {
                    this._logger.info('Chrome debugging port running on %s', chrome.port);
                    return filePath;
                });
            });
    }

    render(destinationType, destDir)
    {
        this.write('@enduml');
        var stream = fs.createWriteStream(this._getInputFile(), 'utf-8');
        this._sb.pipe(stream);
        this._sb.flush();
        this._sb = null;

        var extension;
        if (destinationType == 'txt') {
            extension = '.atxt'
        } else {
            extension = '.' + destinationType;
        }
        var destinationDirectory;
        if (destDir) {
            destinationDirectory = destDir;
        } else {
            destinationDirectory = this._getOutputFile();
        }
        var execArgs = ['-jar', this._massagePath(this._plantUmlPath), this._massagePath(this._getInputFile()), '-o', this._massagePath(destinationDirectory)];
        execArgs.push('-t' + destinationType);
        var command = 'java ' + execArgs.join(' ');
        this._logger.info('Running command: %s', command);
        return ChildProcess.exec(command)
            .then(() => {
                this._logger.info('Diagram rendered.');
                return path.join(destinationDirectory, 'diagram' + extension);
            });
    }

    _getInputFile()
    {
        return path.join(this._workingDir, 'diagram.uml');
    }

    _getOutputFile()
    {
        return this._workingDir;
    }

    _massagePath(str)
    {
        return str.replace(/\\/gi, "\\\\");
    }
}

module.exports = PlantUml;
