var assert = require('assert');
var should = require('should');

describe('registry.js', function() {

    describe('scopeCluster', function() {
        it('existing-1', function () {
            return require('./support/load-registry')('sample2')
                .then(registry => {
                    registry.clusters.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);
                    registry.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(3);
                    return registry.scopeCluster("hello")
                })
                .then(registry =>  {
                    registry.clusters.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(1);
                    var cluster = registry.findById('cluster://hello');
                    should.exist(cluster)

                    registry.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);
                });
        });

        it('existing-2', function () {
            return require('./support/load-registry')('sample2')
                .then(registry => {
                    registry.clusters.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);
                    registry.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(3);
                    return registry.scopeCluster("other")
                })
                .then(registry =>  {
                    registry.clusters.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(1);
                    var cluster = registry.findById('cluster://other');
                    should.exist(cluster)

                    registry.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(1);
                });
        });

        it('missing', function () {
            return require('./support/load-registry')('sample2')
                .then(registry => {
                    registry.clusters.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);
                    registry.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(3);
                    return registry.scopeCluster("notexisting")
                })
                .then(registry =>  {
                    should.not.exist(registry)
                });
        });

    });

    
    describe('scopePolicies', function() {
        it('deployment-prod', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    registry.policies.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(7);
                    return registry.scopePolicies({ deployment: "prod" })
                })
                .then(registry =>  {
                    registry.policies.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(5);
                });
        });

        it('deployment-other', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    registry.policies.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(7);
                    return registry.scopePolicies({ deployment: "other" })
                })
                .then(registry =>  {
                    registry.policies.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);
                });
        });

        it('deployment-prod-cluster-hello', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    registry.policies.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(7);
                    return registry.scopePolicies({ deployment: "prod", cluster: "hello" })
                })
                .then(registry =>  {
                    registry.policies.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(4);
                });
        });
    });


    describe('produceDeploymentRegistry', function() {
        it('existing-cluster', function () {
            return require('./support/load-registry')('sample2')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), {deployment: 'prod', cluster: 'hello'}, 'hello')
                })
                .then(registry => {
                    should.exist(registry)

                    registry.clusters.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(3);

                    var cluster = registry.findById('cluster://hello');
                    should.exist(cluster)
                    cluster.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);

                    var sector = registry.findById('sector://hello-main');
                    should.exist(sector)
                    sector.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(2);

                    var supportCluster  = registry.findById('cluster://sprt');
                    should.exist(supportCluster)
                    supportCluster.services.map(x => x.name).should.be.instanceof(Array).and.have.lengthOf(3);
                });
        });

        it('missing-cluster', function () {
            return require('./support/load-registry')('sample2')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), {deployment: 'prod', cluster: 'hello'}, 'notpresent')
                        .should.be.rejected;
                });
        });
    });

});