module.exports = {
    info: function() {
        // console.log("[INFO] ")
        // console.log(arguments)
    },
    error: function() {
        console.log("[ERROR] ")
        console.log(arguments)
    },
    warn: function() {
        console.log("[WARN] ")
        console.log(arguments)
    },
    exception: function() {
        console.log("[EXCEPTION] ")
        console.log(arguments)
    },
    verbose: function() {
        // console.log("[VERBOSE] ")
        // console.log(arguments)
    },
    silly: function() {
        // console.log("[SILLY] ")
        // console.log(arguments)
    },
    debug: function() {
        // console.log("[DEBUG] ")
        // console.log(arguments)
    }
}