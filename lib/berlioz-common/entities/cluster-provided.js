const Base = require('./base');
const _ = require('the-lodash');

class ClusterProvided extends Base
{
    constructor(definition, cluster)
    {
        definition.kind = 'cluster-provided';
        if (!definition.sectorName) {
            definition.sectorName = 'main';
        }
        if (!definition.endpointName) {
            definition.endpointName = 'default';
        }
        super(definition, [cluster.name, definition.name]);
        this._cluster = cluster;
        this._service = null;
        this._serviceProvided = null;
        this._isImplicit = true;
    }

    get name() {
        return this.definition.name;
    }

    get cluster() {
        return this._cluster;
    }

    get service() {
        return this._service;
    }

    get serviceId() {
        if (this.service) {
            return this.service.id;
        }
        return null;
    }

    get serviceProvided() {
        return this._serviceProvided;
    }

    get isPublic() {
        return Base.parseBool(this.definition.public);
    }

    postLoad()
    {
        this._service = this.cluster.getServiceByNaming(this.definition.sectorName, this.definition.serviceName);
        if (!this._service) {
            throw new Error('Service ' + this.definition.serviceName + ' not present in cluster ' + this.cluster.name);
        }

        this._serviceProvided = this._service.provides[this.definition.endpointName];
        if (!this._serviceProvided) {
            throw new Error('Endpoint ' + this.definition.endpointName + ' not present in service ' + this.definition.serviceName);
        }

        this._serviceProvided._isPublic = this.isPublic;

        this._serviceProvided._clusterProvided = this;

    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
        data.push(['serviceName', this.service.name]);
        data.push(['serviceId', this.serviceId]);
        data.push(['endpointName', this.serviceProvided.name]);
        data.push(['isPublic', this.isPublic]);
    }

    _getPolicyTarget()
    {
        var target = this.cluster._getPolicyTarget();
        target = _.clone(target);
        target.endpoint = this.name;
        return target;
    }

}


module.exports = ClusterProvided;
