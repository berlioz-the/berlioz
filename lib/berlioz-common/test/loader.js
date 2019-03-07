var assert = require('assert');
var should = require('should');

describe('loader.js', function() {
    describe('load', function() {
        it('sample1', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    registry.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);
                    registry.clusters.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(1);

                    var cluster = registry.findById('cluster://hello');
                    should.exist(cluster)
                    cluster.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);
                    cluster.sectors.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(1);

                    var cluster = registry.findById('cluster://hello');
                    should.exist(cluster)
                    cluster.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);
                    cluster.sectors.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(1);

                    var sector = registry.findById('sector://hello-main');
                    should.exist(sector)
                    sector.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);
                });
        });

    });
});