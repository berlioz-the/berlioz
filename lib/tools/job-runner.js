const Promise = require('the-promise');
const { fork } = require('child_process');
const path = require('path');


function runJob(message, name)
{
    return new Promise((resolve, reject) => {
        const job = fork(path.join(__dirname, 'jobs/' + name + '.js'));
        job.send(message);
        job.on('message', response => {
            job.disconnect();
            if (response.failed) {
                reject(response.reason);
            } else {
                resolve(response.result);
            }
        });
    });
}

exports.copy = function(src, dest, options) {
    var message = {
        src: src,
        dest: dest,
        options: options
    }
    return runJob(message, 'copy');
}

exports.compressDirectoryToFile = function(codeDir, outputFilePath) {
    var message = {
        codeDir: codeDir,
        outputFilePath: outputFilePath
    }
    return runJob(message, 'archive');
}

exports.calculateSha256FromFile = function(filePath) {
    var message = {
        filePath: filePath
    }
    return runJob(message, 'checksum');
}
