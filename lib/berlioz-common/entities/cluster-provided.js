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

        this._serviceNaming = [
            cluster.name,
            this.definition.sectorName,
            this.definition.serviceName
        ];
        this._serviceId = Base.constructID('service', this._serviceNaming);
    }

    get name() {
        return this.definition.name;
    }

    get cluster() {
        return this._cluster;
    }

    get serviceId() {
        return this._serviceId;
    }

    get service() {
        return this.registry.findByNaming('service', this._serviceNaming);
    }

    get endpointName() {
        return this.definition.endpointName;
    }

    get serviceProvided()
    {
        if (!this.service) {
            return null;
        }
        return this.service.provides[this.endpointName];
    }

    get isPublic() {
        return Base.parseBool(this.definition.public);
    }

    postLoad()
    {
        if (this.serviceProvided) {
            this.serviceProvided._isPublic = this.isPublic;
            this.serviceProvided._clusterProvided = this;
        }
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

    _handleAddToRegistry(registry)
    {
        super._handleAddToRegistry(registry);
        this.setPath(this._cluster.berliozfile);
    }

    validateSemantics(validator)
    {
        super.validateSemantics(validator);
        if (!this.service) {
            validator.submitItemError(this, `Unresolved exposed service. Target: ${this.serviceId}`);
        }
        else {
            if (!this.serviceProvided) {
                validator.submitItemError(this, `Unresolved exposed service. Target: ${this.serviceId}, Endpoint: ${this.endpointName}`);
            }
        }

    }
}


module.exports = ClusterProvided;
