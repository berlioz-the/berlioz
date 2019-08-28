var assert = require('assert');
var should = require('should');
var path = require('path');
var utils = require('./support/utils');
var async = require('async')


describe('compiler.js', function() {

    describe('compile', function() {
        it('sample1', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    return registry.compile(require('./support/logger'))
                })
                .then(registry => {
                    registry.clusters.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(3);

                    var cluster = registry.findById('cluster://hello');
                    should.exist(cluster)
                    cluster.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);

                    var sector = registry.findById('sector://hello-main');
                    should.exist(sector)
                    sector.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);

                    supportCluster = registry.findById('cluster://sprt');
                    should.exist(supportCluster)
                    supportCluster.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(3);
                });
        });

    });

    describe('post-compile-validation', function () {

        var dirs = utils.getSubDirectories(path.join(__dirname, 'data', 'valid-samples'));
        async.each(dirs, function(name, callback) {

            it(name, function() {
                // console.log('----------- ' + name);
                var sampleDir = path.join('valid-samples', name);
                return require('./support/load-registry').loadRaw(sampleDir)
                    .then(registry => {
                        var validator = registry.validate();
                        return Promise.resolve(validator.enforce())
                            .then(() => registry.compile(require('./support/logger')));
                    })
                    .then(compiledRegistry => {
                        var validator = compiledRegistry.validate();
                        console.log(validator._errors);
                        return validator.enforce();
                    });
            });

            callback();
        });

    });
    
});