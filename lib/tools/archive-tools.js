const fs = require('fs');
const archiver = require('archiver');
const MemoryStream = require('memory-stream');

function archiveDirectory(path, outputStream)
{
    var archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
        // log warning
        } else {
        // throw error
            throw err;
        }
    });

    // good practice to catch this error explicitly
    archive.on('error', function(err) {
        throw err;
    });

    // pipe archive data to the file
    archive.pipe(outputStream);
    archive.directory(path, false);

    archive.finalize();
}

exports.compressDirectoryToBuffer = function(path) {
    return new Promise(function(resolve, reject) {
        try {
            var output = new MemoryStream();
            output.on('finish', function() {
                resolve(output.toBuffer());
            });

            archiveDirectory(path, output);
        } catch (e) {
            reject(e)
        }
    });
}

exports.compressDirectoryToFile = function(path, outputFile) {
    return new Promise(function(resolve, reject) {
        try {
            var output = fs.createWriteStream(outputFile);
            output.on('close', function() {
                resolve()
            });

            archiveDirectory(path, output);
        } catch (e) {
            reject(e)
        }
    });
}
