const Path = require('path');

module.exports.newNativeProcessor = function(logger, helper) {
    const NativeProcessor = require('./processing/native-processor');
    return new NativeProcessor(logger.sublogger('NativeProcessor'), helper);
}

module.exports.getModelsDir = function(providerKind) {
    return Path.join(__dirname, 'processing', 'models', providerKind);
} 