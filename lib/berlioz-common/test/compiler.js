var assert = require('assert');
var should = require('should');

describe('compiler.js', function() {

    describe('compile', function() {
        it('sample1', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    return registry.compile(require('./support/logger'))
                })
                .then(registry => {
                    registry.clusters.should.be.instanceof(Array).and.have.lengthOf(1);

                    var cluster = registry.findById('cluster://hello');
                    should.exist(cluster)
                    cluster.services.should.be.instanceof(Array).and.have.lengthOf(7);

                    var sector = registry.findById('sector://hello-main');
                    should.exist(sector)
                    sector.services.should.be.instanceof(Array).and.have.lengthOf(3);

                    sector = registry.findById('sector://hello-infra');
                    should.exist(sector)
                    sector.services.should.be.instanceof(Array).and.have.lengthOf(4);
                });
        });

    });

    
});