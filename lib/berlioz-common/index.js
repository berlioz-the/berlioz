const Path = require('path');

module.exports.newNativeProcessor = function(logger) {
    const NativeProcessor = require('./processing/native-processor');
    return new NativeProcessor(logger.sublogger('NativeProcessor'));
}

module.exports.getModelsDir = function(providerKind) {
    return Path.join(__dirname, 'processing', 'models', providerKind);
} 