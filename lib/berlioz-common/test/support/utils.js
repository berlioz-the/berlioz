var fs = require('fs');
var path = require('path');

module.exports.getSubDirectories = function (rootdir) {
    var files = fs.readdirSync(rootdir);
    var dirs = files.filter(x => {
        var filePath = path.join(rootdir, x);
        return fs.statSync(filePath).isDirectory();
    })
    return dirs;
}