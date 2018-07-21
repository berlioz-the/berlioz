const crypto = require('crypto');
const fs = require('fs');

exports.calculateSha256FromBuffer = function(buffer)
{
    return new Promise(function(resolve, reject) {
        const hash = crypto.createHash('sha256');

        hash.on('readable', () => {
            const data = hash.read();
            if (data) {
                resolve(data.toString('hex'));
            } else {
                reject('data not present');
            }
        });

        hash.write(buffer);
        hash.end();
    });
}

exports.calculateSha256FromStream = function(inputStream)
{
    return new Promise(function(resolve, reject) {
        const hash = crypto.createHash('sha256');
        inputStream.on('readable', () => {
            const data = inputStream.read();
            if (data) {
                hash.update(data)
            } else {
                resolve(hash.digest('hex'));
            }
        });
    });
}

exports.calculateSha256FromFile = function(filePath)
{
    var inputStream = fs.createReadStream(filePath)
    return exports.calculateSha256FromStream(inputStream)
}