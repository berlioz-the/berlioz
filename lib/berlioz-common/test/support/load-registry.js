var Loader = require('../../loader');
var logger = require('./logger');
var path = require('path');

module.exports = function(name) {
    var loader = new Loader(logger);
    var projPath = path.join(__dirname, '..', 'data', name);
    loader._logger.info("LOAD-REGISTRY: %s...", projPath);
    return loader.fromDir(projPath);
}