var assert = require('assert');
var should = require('should');
var fs = require('fs');
var path = require('path');
var Promise = require('the-promise');
var async = require('async')

function getSubDirectories(rootdir) {
    var files = fs.readdirSync(rootdir);
    var dirs = files.filter(x => {
        var filePath = path.join(rootdir, x);
        return fs.statSync(filePath).isDirectory();
    })
    return dirs;
}

describe('validator.js', function() {
    
    describe('invalids', function() {
        var dirs = getSubDirectories(path.join(__dirname, 'data', 'invalid-samples'));
        async.each(dirs, function(name, callback) {

            it('sample-invalid-' + name, function () {
                var sampleDir = path.join('invalid-samples', name);
                return require('./support/load-registry')(sampleDir)
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

        var dirs = getSubDirectories(path.join(__dirname, 'data'));
        dirs = dirs.filter(x => x != 'invalid-samples')
        async.each(dirs, function(name, callback) {

            it('sample-valid-' + name, function() {
                // console.log('----------- ' + name);
                var sampleDir = name;
                return require('./support/load-registry')(sampleDir)
                    .then(registry => {
                        var validator = registry.validate();
                        return validator.enforce();
                    });
            });

            callback();
        });

    });


});