var assert = require('assert');
var should = require('should');

describe('loader.js', function() {
    describe('load', function() {
        it('sample1', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    registry.services.should.be.instanceof(Array).and.have.lengthOf(2);
                    registry.clusters.should.be.instanceof(Array).and.have.lengthOf(1);

                    var cluster = registry.findById('cluster://hello');
                    should.exist(cluster)
                    cluster.services.should.be.instanceof(Array).and.have.lengthOf(2);
                    cluster.sectors.should.be.instanceof(Array).and.have.lengthOf(1);

                    var cluster = registry.findById('cluster://hello');
                    should.exist(cluster)
                    cluster.services.should.be.instanceof(Array).and.have.lengthOf(2);
                    cluster.sectors.should.be.instanceof(Array).and.have.lengthOf(1);

                    var sector = registry.findById('sector://hello-main');
                    should.exist(sector)
                    sector.services.should.be.instanceof(Array).and.have.lengthOf(2);
                });
        });

    });
});