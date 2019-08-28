var assert = require('assert');
var should = require('should');
var path = require('path');
var Promise = require('the-promise');
var async = require('async')

var utils = require('./support/utils');

describe('validator.js', function() {
    
    describe('invalids', function() {
        var dirs = utils.getSubDirectories(path.join(__dirname, 'data', 'invalid-samples'));
        async.each(dirs, function(name, callback) {

            it('sample-invalid-' + name, function () {
                var sampleDir = path.join('invalid-samples', name);
                return require('./support/load-registry').loadRaw(sampleDir)
                    .then(registry => {
                        assert.throws(() => {
                            var validator = registry.validate();
                            validator.enforce();
                        })
                    })
            });

            callback();
        });
    });


    describe('valids', function () {

        var dirs = utils.getSubDirectories(path.join(__dirname, 'data', 'valid-samples'));
        async.each(dirs, function(name, callback) {

            it('sample-valid-' + name, function() {
                // console.log('----------- ' + name);
                var sampleDir = path.join('valid-samples', name);
                return require('./support/load-registry').loadRaw(sampleDir)
                    .then(registry => {
                        var validator = registry.validate();
                        return validator.enforce();
                    });
            });

            callback();
        });

    });


});