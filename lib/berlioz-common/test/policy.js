var assert = require('assert');
var should = require('should');

describe('policy-resolver.js', function() {
    
    describe('registry::resolvePolicy', function() {
        it('present-deployment-level', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    var policy = registry.resolvePolicy('somepol', { deployment: 'prod', service: 'app' })
                    should.exist(policy)
                    should.exist(policy.value)
                    policy.value.should.be.false()
                });
        });

        it('present-deployment-service-level', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    var policy = registry.resolvePolicy('somepol', { deployment: 'prod', service: 'web' })
                    should.exist(policy)
                    should.exist(policy.value)
                    policy.value.should.be.true()
                });
        });

        it('missing', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    var policy = registry.resolvePolicy('somepol', { deployment: 'test' })
                    should.exist(policy)
                    policy.should.have.only.keys()
                });
        });

    });

    
});