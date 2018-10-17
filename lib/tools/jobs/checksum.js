const HashTools = require('../hash-tools');

process.on('message', (message) => {
    try
    {
        HashTools.calculateSha256FromFile(message.filePath)
            .then(result => {
                process.send({result: result})
            })
            .catch(reason => {
                process.send({reason: reason});
            });
    }
    catch(error)
    {
        process.send({failed: true, reason: error});
    }
});