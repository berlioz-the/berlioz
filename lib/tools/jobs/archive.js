const ArchiveTools = require('../archive-tools');

process.on('message', (message) => {
    try
    {
        ArchiveTools.compressDirectoryToFile(message.codeDir, message.outputFilePath)
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