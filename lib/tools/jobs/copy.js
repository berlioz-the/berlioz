// const fsUtils = require("nodejs-fs-utils");
const fsUtils = require("../../external/nodejs-fs-utils");

process.on('message', (message) => {
    try
    {
        console.log("[JOB-COPY] Start. From: " + message.src + ", To: " + message.dest + ", Options: " + JSON.stringify(message.options))
        fsUtils.copy(message.src, message.dest, (error, result) => {
            console.log(result)
            if (error) {
                console.log("[JOB-COPY] Failure. From: " + message.src + ", To: " + message.dest)
                console.log(error)
                process.send({failed: true, reason: error});
            } else {
                console.log("[JOB-COPY] Finish. From: " + message.src + ", To: " + message.dest)
                process.send({result: result})
            }
        }, message.options) 
    }
    catch(error)
    {
        process.send({failed: true, reason: error});
    }
});