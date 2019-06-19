const Joi = require('@hapi/joi');

Joi.clusterName = function() {
    return Joi.string().regex(Joi.clusterNameRegex());
} 

Joi.sectorName = function() {
    return Joi.string().regex(Joi.sectorNameRegex());
} 

Joi.serviceName = function() {
    return Joi.string().regex(Joi.serviceNameRegex());
} 

Joi.lambdaName = function() {
    return Joi.string().regex(Joi.lambdaNameRegex());
} 

Joi.databaseName = function() {
    return Joi.string().regex(Joi.databaseNameRegex());
} 

Joi.queueName = function() {
    return Joi.string().regex(Joi.queueNameRegex());
} 

Joi.triggerName = function() {
    return Joi.string().regex(Joi.triggerNameRegex());
} 

Joi.endpointName = function() {
    return Joi.string().regex(Joi.endpointNameRegex());
} 

Joi.clusterNameRegex = function() {
    return /^[a-zA-Z][a-zA-Z0-9]{0,6}$/;
} 

Joi.sectorNameRegex = function() {
    return /^[a-zA-Z][a-zA-Z0-9]{0,4}$/;
} 

Joi.serviceNameRegex = function() {
    return /^[a-zA-Z][a-zA-Z0-9]{0,5}$/;
} 

Joi.databaseNameRegex = function() {
    return /^[a-zA-Z][a-zA-Z0-9_]{0,30}$/;
} 

Joi.queueNameRegex = function() {
    return /^[a-zA-Z][a-zA-Z0-9]{0,30}$/;
} 

Joi.triggerNameRegex = function() {
    return /^[a-zA-Z][a-zA-Z0-9]{0,30}$/;
} 

Joi.lambdaNameRegex = function() {
    return /^[a-zA-Z][a-zA-Z0-9]{0,30}$/;
} 

Joi.endpointNameRegex = function() {
    return /^[a-zA-Z][a-zA-Z0-9]{0,6}$/;
} 

Joi.environmentMap = function() {
    return Joi.object().pattern(/^/, Joi.alternatives(
        Joi.string(),
        Joi.number(),
        Joi.boolean()
    ))
} 

module.exports = Joi;