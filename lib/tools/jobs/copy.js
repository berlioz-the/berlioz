const copy = require('recursive-copy');

process.on('message', (message) => {
    try
    {
        copy(message.src, message.dest, message.options)
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