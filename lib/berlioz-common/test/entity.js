var assert = require('assert');
var should = require('should');

describe('entity.js', function() {
    
    describe('resolvePolicy', function() {
        it('service-level-1', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), 
                        {
                            deployment: 'prod', 
                            cluster: 'hello'
                        }, 'hello')
                })
                .then(registry => {
                    var service = registry.findById('service://hello-main-web');
                    should.exist(service)

                    var policy = service.resolvePolicy('scale');
                    should.exist(policy)
                    policy.min.should.be.exactly(100)
                    policy.max.should.be.exactly(200)
                    policy.desired.should.be.exactly(150)

                    var scaling = service.getScaling();
                    should.exist(scaling)
                    should(scaling.min).be.exactly(100)
                    should(scaling.max).be.exactly(200)
                    should(scaling.desired).be.exactly(150)
                });
        });

        it('service-level-2', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), 
                        {
                            deployment: 'test',
                            cluster: 'hello'
                        }, 'hello')
                })
                .then(registry => {
                    var service = registry.findById('service://hello-main-web');
                    should.exist(service)

                    var policy = service.resolvePolicy('scale');
                    should.exist(policy)
                    policy.min.should.be.exactly(10)
                    policy.max.should.be.exactly(15)
                    should(policy.desired).not.be.ok

                    var scaling = service.getScaling();
                    should.exist(scaling)
                    should(scaling.min).be.exactly(10)
                    should(scaling.max).be.exactly(15)
                    should(scaling.desired).be.exactly(10)
                });
        });

        it('service-level-3', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), 
                        {
                            deployment: 'local',
                            cluster: 'hello'
                        }, 'hello')
                })
                .then(registry => {
                    var service = registry.findById('service://hello-main-web');
                    should.exist(service)

                    var policy = service.resolvePolicy('scale');
                    should.exist(policy)
                    policy.min.should.be.exactly(5)
                    policy.max.should.be.exactly(6)
                    should(policy.desired).not.be.ok

                    var scaling = service.getScaling();
                    should.exist(scaling)
                    should(scaling.min).be.exactly(5)
                    should(scaling.max).be.exactly(6)
                    should(scaling.desired).be.exactly(5)
                });
        });

        it('service-level-4', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), 
                        {
                            deployment: 'another', 
                            cluster: 'hello'
                        }, 'hello')
                })
                .then(registry => {
                    var service = registry.findById('service://hello-main-web');
                    should.exist(service)

                    var policy = service.resolvePolicy('scale');
                    should.exist(policy)
                    should(policy.desired).not.be.ok
                    should(policy.min).not.be.ok
                    should(policy.max).not.be.ok

                    var scaling = service.getScaling();
                    should.exist(scaling)
                    should(scaling.min).be.exactly(1)
                    should(scaling.max).be.exactly(1)
                    should(scaling.desired).be.exactly(1)
                });
        });

        it('service-level-5', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), 
                        {
                            deployment: 'prod',
                            cluster: 'hello'
                        }, 'hello')
                })
                .then(registry => {
                    var service = registry.findById('service://hello-main-web');
                    should.exist(service)

                    var policy = service.resolvePolicy('somepol');
                    should.exist(policy)
                    policy.value.should.be.exactly(true)
                });
        });

        it('service-level-6', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), 
                        {
                            deployment: 'prod',
                            cluster: 'hello'
                        }, 'hello')
                })
                .then(registry => {
                    var service = registry.findById('service://hello-main-app');
                    should.exist(service)

                    var policy = service.resolvePolicy('somepol');
                    should.exist(policy)
                    policy.value.should.be.exactly(false)
                });
        });

        it('service-level-7', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), 
                        {
                            deployment: 'test',
                            cluster: 'hello'
                        }, 'hello')
                })
                .then(registry => {
                    var service = registry.findById('service://hello-main-app');
                    should.exist(service)

                    var policy = service.resolvePolicy('somepol');
                    should.exist(policy)
                    should.not.exist(policy.value)
                });
        });

        it('service-level-8', function () {
            return require('./support/load-registry')('sample1')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), 
                        {
                            deployment: 'another', 
                            cluster: 'hello'
                        }, 'hello')
                })
                .then(registry => {
                    var service = registry.findById('service://hello-main-app');
                    should.exist(service)

                    var policy = service.resolvePolicy('scale');
                    should.exist(policy)
                    should(policy.min).be.equal(5)
                    should(policy.max).be.equal(11)
                    should(policy.desired).not.be.ok

                    var scaling = service.getScaling();
                    should.exist(scaling)
                    should(scaling.min).be.exactly(5)
                    should(scaling.max).be.exactly(11)
                    should(scaling.desired).be.exactly(5)
                });
        });

        it('sample3-scale-policy-local-front', function () {
            return require('./support/load-registry')('sample3')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), 
                        {
                            deployment: 'local',
                            cluster: 'fundme'
                        }, 'fundme')
                })
                .then(registry => {
                    var service = registry.findById('service://fundme-main-front');
                    should.exist(service)

                    var policy = service.resolvePolicy('scale');
                    should.exist(policy)
                    should.exist(policy.desired)
                    policy.desired.should.be.exactly(4)
                    
                    var scaling = service.getScaling();
                    should.exist(scaling)
                    should(scaling.min).be.exactly(1)
                    should(scaling.max).be.exactly(4)
                    should(scaling.desired).be.exactly(4)
                });
        });

        it('sample3-scale-policy-prod-front', function () {
            return require('./support/load-registry')('sample3')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), {deployment: 'prod', cluster: 'fundme'}, 'fundme')
                })
                .then(registry => {
                    var service = registry.findById('service://fundme-main-front');
                    should.exist(service)

                    var policy = service.resolvePolicy('scale');
                    should.exist(policy)
                    should.exist(policy.desired)
                    policy.desired.should.be.exactly(3)

                    var scaling = service.getScaling();
                    should.exist(scaling)
                    should(scaling.min).be.exactly(1)
                    should(scaling.max).be.exactly(3)
                    should(scaling.desired).be.exactly(3)
                });
        });
        
        it('sample3-scale-policy-test-front', function () {
            return require('./support/load-registry')('sample3')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), {deployment: 'test', cluster: 'fundme'}, 'fundme')
                })
                .then(registry => {
                    var service = registry.findById('service://fundme-main-front');
                    should.exist(service)

                    var policy = service.resolvePolicy('scale');
                    should.exist(policy)
                    should.exist(policy.desired)
                    policy.desired.should.be.exactly(2)

                    var scaling = service.getScaling();
                    should.exist(scaling)
                    should(scaling.min).be.exactly(1)
                    should(scaling.max).be.exactly(2)
                    should(scaling.desired).be.exactly(2)
                });
        });

               
        it('sample3-scale-policy-test-redis', function () {
            return require('./support/load-registry')('sample3')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), {deployment: 'test', cluster: 'fundme'}, 'fundme')
                })
                .then(registry => {
                    var service = registry.findById('service://fundme-main-redis');
                    should.exist(service)

                    var policy = service.resolvePolicy('scale');
                    should.exist(policy)
                    should.exist(policy.desired)
                    policy.desired.should.be.exactly(3)
                    
                    var scaling = service.getScaling();
                    should.exist(scaling)
                    should(scaling.min).be.exactly(1)
                    should(scaling.max).be.exactly(3)
                    should(scaling.desired).be.exactly(3)
                });
        });

        it('sample3-scale-policy-another-redis', function () {
            return require('./support/load-registry')('sample3')
                .then(registry => {
                    return registry.produceDeploymentRegistry(require('./support/logger'), {deployment: 'another', cluster: 'fundme'}, 'fundme')
                })
                .then(registry => {
                    var service = registry.findById('service://fundme-main-redis');
                    should.exist(service)

                    var policy = service.resolvePolicy('scale');
                    should.exist(policy)
                    should.exist(policy.desired)
                    policy.desired.should.be.exactly(3)

                    var scaling = service.getScaling();
                    should.exist(scaling)
                    should(scaling.min).be.exactly(1)
                    should(scaling.max).be.exactly(3)
                    should(scaling.desired).be.exactly(3)
                });
        });
    });

    
});