var Loader = require('../../Loader');
var logger = require('./logger');
var path = require('path');

module.exports = function(name) {
    var loader = new Loader(logger);
    return loader.fromDir(path.join(__dirname, '..', 'data', name))
}