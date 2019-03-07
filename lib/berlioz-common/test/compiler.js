var assert = require('assert');
var should = require('should');

describe('compiler.js', function() {

    describe('compile', function() {
        it('sample1', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    console.log("********************************************")
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

    
});