const HashTools = require('../hash-tools');

process.on('message', (message) => {
    try
    {
        HashTools.calculateSha256FromFile(message.filePath)
            .then(result => {
                process.send({result: result})
            })
            .catch(reason => {
                console.log(reason);
                process.send({failed: true, reason: reason});
            });
    }
    catch(error)
    {
        process.send({failed: true, reason: error});
    }
});