const Base = require('./base');
const _ = require('the-lodash');
const ClusterProvided = require('./cluster-provided');
const Sector = require('./sector');

class Cluster extends Base
{
    constructor(definition)
    {
        super(definition, definition.name);
        this._massageProvidesConfig();
    }

    get name() {
        return this.definition.name;
    }
    
    get sectors() {
        return this.getLinks('sector');
    }

    get services() {
        return this.getLinks('service');
    }

    get images() {
        return this.getLinks('image');
    }

    get databases() {
        return this.getLinks('database');
    }

    get queues() {
        return this.getLinks('queue');
    }

    get secrets() {
        return this.getLinks('secret');
    }

    get lambdas() {
        return this.getLinks('lambda');
    }

    get provides() {
        return this._provides;
    }

    get environment() {
        if (this.definition.environment) {
            return this.definition.environment;
        }
        return {};
    }

    getImageByName(name)
    {
        for(var image of this.iamges) {
            if (image.definition.name == name) {
                return image;
            }
        }
        return null;
    }
    
    getSectorByName(sectorName)
    {
        return this._registry.findByNaming('sector', [this.name, sectorName]);        
    }

    getServiceByNaming(sectorName, serviceName)
    {
        return this._registry.findByNaming('service', [this.name, sectorName, serviceName]);        
    }

    getServiceByFullName(name)
    {
        for(var service of this.services) {
            var full_name = service.clusterName + '-' + service.name;
            if (full_name == name) {
                return service;
            }
        }
        return null;
    }

    _massageProvidesConfig()
    {
        this._provides = {};

        if (!this.definition.provides) {
            return;
        }

        for (var providedName of _.keys(this.definition.provides))
        {
            var configProvided = this.definition.provides[providedName];

            var provided = new ClusterProvided({
                name: providedName,
                serviceName: configProvided.service,
                sectorName: configProvided.sector,
                endpointName: configProvided.endpoint,
                public: Base.parseBool(configProvided.public),
            }, this);
            this._provides[providedName] = provided;
        }
    }

    postLoad()
    {
        for(var provided of _.values(this.provides))
        {
            provided.postLoad();
        }
    }

    acceptItem(item)
    {
        this.link(item);
        if (item.sectorName)
        {
            var sector = this._fetchSector(item.sectorName);
            sector.link(item);
        }
    }

    _fetchSector(name)
    {
        var sector = this._registry.findByNaming('sector', [this.name, name]);
        if (!sector) {
            sector = new Sector({
                kind: 'sector',
                cluster: this.name,
                name: name
            });
            sector.addToRegistry(this._registry);
            this.link(sector);
        }
        return sector;
    }

    extractData(data)
    {
        super.extractData(data);
        data.push(['name', this.name]);
        data.push(['image count', this.images.length.toString()]);
        data.push(['service count', this.services.length.toString()]);
    }

    extractDefinitions()
    {
        var definitions = [];
        definitions.push(this.definition);
        for(var item of this.allLinks)
        {
            if (!item.isImplicit) {
                definitions.push(item.definition);
            }
        }
        return definitions;
    }

    _handleAddToRegistry(registry)
    {
        for(var x of _.values(this.provides)) {
            x.addToRegistry(registry);
        }
    }

    _getPolicyTarget()
    {
        return {
            cluster: this.name
        };
    }

}


module.exports = Cluster;
