const Base = require('./base');
const _ = require('the-lodash');

class ServiceProvided extends Base
{
    constructor(definition, service)
    {
        definition.kind = 'service-provided';
        Base.setupSector(definition)
        super(definition, _.concat(service.naming, [definition.name]));
        this._service = service;
        this._isPublic = false;
        this._isImplicit = true;
        this._clusterProvided = null;
    }

    get service() {
        return this._service;
    }

    get name() {
        return this.definition.name;
    }

    get port() {
        return this.definition.port;
    }

    get protocol() {
        return this.definition.protocol;
    }

    get networkProtocol() {
        return this.definition.networkProtocol;
    }

    get reserved() {
        return Base.parseBool(this.definition.reserved);
    }

    get loadBalance() {
        return Base.parseBool(this.definition.loadBalance);
    }

    get dns() {
        return Base.parseBool(this.definition.dns);
    }

    get multipleSubdomains() {
        return Base.parseBool(this.definition.multipleSubdomains);
    }

    get isPublic() {
        return this._isPublic;
    }

    get clusterProvided() {
        return this._clusterProvided;
    }

    get peerOverridePolicy() {
        var overridePolicy = this.resolvePolicy('service-endpoint-override');
        return overridePolicy;
    }

    get shouldOverride() {
        var policy = this.peerOverridePolicy;
        if (policy.override) {
            return true;
        }
        return false;
    }

    get overriddenPeers() {
        var policy = this.peerOverridePolicy;
        if (!policy.override) {
            return [];
        }
        if (!policy.peers) {
            return [];
        }
        return policy.peers;
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
        data.push(['port', this.port]);
        data.push(['protocol', this.protocol]);
        data.push(['networkProtocol', this.networkProtocol]);
        data.push(['reserved', this.reserved]);
        data.push(['loadBalance', this.loadBalance]);
        data.push(['dns', this.dns]);
        data.push(['isPublic', this.isPublic]);
    }

    _getPolicyTarget()
    {
        var target = this.service._getPolicyTarget();
        target = _.clone(target);
        target.endpoint = this.name;
        return target;
    }

}


module.exports = ServiceProvided;
