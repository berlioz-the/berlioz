const Promise = require('the-promise');
const _ = require('the-lodash');
const StringBuilder = require("string-builder");

module.exports = (section, logger, {docker, helper, cluster, screen}) => {

    section
        .onQueryAll(() => docker.listContainersByKind({
            'berlioz:kind': 'load-balancer',
            'berlioz:cluster': cluster
        }))
        .onExtractNaming(obj => {
            return helper.parseContainerTaskNaming(obj);
        })
        .onExtractId(obj => obj.Id)
        .onQuery(id => docker.queryContainer(id))
        .onExtractConfig(obj => {
            var config = {
                labels: helper.getContainerLabels(obj),
                ports: {
                    tcp: {},
                    udp: {}
                },
                aliases: {}
            };
            for(var binding of helper.parseContainerPortBingings(obj))
            {
                config.ports[binding.protocol][binding.port] = binding.hostPort;
            }
            config.image = obj.Config.Image;
            config.imageId = obj.Image;
            config.haProxyConfigPath = config.labels['berlioz:haproxycfg'];
            config.ipAddress = _.get(obj, "NetworkSettings.Networks.berlioz.IPAddress", "");

            var aliasesArr = _.get(obj, "NetworkSettings.Networks.berlioz.Aliases", []);
            if (aliasesArr)
            {
                for(var x of aliasesArr)
                {
                    if (x != obj.Config.Hostname)
                    {
                        config.aliases[x] = true
                    }
                }
            }

            return Promise.resolve(helper.readFromFile(config.haProxyConfigPath))
                .then(contents => {
                    config.haproxycfg = contents;
                })
                .then(() => config);
        })
        .onExtractRelations(item => {
            item.inverseRelation('ready-load-balancer', item.naming)
                .setupSourceAutoCreate();
        })
        .onAutoConfig((item, action) => {
            var targets = item.findRelations('load-balancer-target').map(x => x.targetItem);
            var servers = targets.map(lbTarget => {
                var task = lbTarget.findRelation('task').targetItem;
                var containerIp = helper.getContainerIp(task);
                if (containerIp) {
                    return containerIp + ':' + lbTarget.config.port;
                }
            }).filter(x => x);

            item.config.haproxycfg = constructHAConfig(servers);

            return true;
        })
        .onCreate(delta => {
            return startLb(delta);
        })
        .onUpdate(delta => {
            if ('haproxycfg' in delta.delta.configs) {
                return Promise.resolve()
                    .then(() => reloadConfig(delta))
                    .then(() => setupLBConfig(delta));
            }
        })
        .onUpdateRecreate(delta => {
            if (delta == null) {
                return true;
            }
            if ('haproxycfg' in delta.delta.configs) {
                return false;
            }
            return true;
        })
        .onDelete(delta => {
            return stopTask(delta);
        })
        ;

    function startLb(delta)
    {
        return Promise.resolve()
            .then(() => setupLBConfig(delta))
            .then(() => startTask(delta))
            ;
    }

    function setupLBConfig(delta)
    {
        return Promise.resolve()
            .then(() => helper.writeToFile(delta.config.haProxyConfigPath, delta.config.haproxycfg))
            ;
    }

    function startTask(delta)
    {
        screen.info('Starting %s...', delta.dn);

        logger.info('[startTask] dn: %s', delta.dn);
        var containerConfig = {
            AttachStdin: false,
            AttachStdout: false,
            AttachStderr: false,
            Tty: false,
            OpenStdin: false,
            StdinOnce: false,

            // Name: delta.config.name,
            Image: delta.config.image,
            Labels: delta.config.labels,
            ExposedPorts: {},
            HostConfig: {
                CapAdd: [ "NET_ADMIN" ],
                SecurityOpt: ["apparmor:unconfined"],
                PortBindings: {},
                Binds: [
                    delta.config.haProxyConfigPath + ':' + '/etc/haproxy/haproxy.cfg'
                ]
            },
            NetworkingConfig: {
                EndpointsConfig: {
                    berlioz: {
                        IPAMConfig: {
                            IPv4Address: delta.config.ipAddress
                        },
                        Aliases: _.keys(delta.config.aliases)
                    }
                }
            }
        };

        for(var protocol of _.keys(delta.config.ports))
        {
            for(var port of _.keys(delta.config.ports[protocol]))
            {
                var hostPort = delta.config.ports[protocol][port];
                containerConfig.ExposedPorts[port.toString() + '/' + protocol] = {};
                containerConfig.HostConfig.PortBindings[port.toString() + '/' + protocol] = [{
                    HostPort: hostPort.toString()
                }];
            }
        }
        logger.info('[startTask] Creating load-balancer container %s: ', delta.dn, containerConfig);
        return Promise.resolve()
            .then(() => docker.startContainer(containerConfig))
            ;
    }

    function stopTask(delta)
    {
        screen.info('Stopping %s...', delta.dn);

        logger.info('[stopLoadBalancer] dn: %s', delta.dn);
        return Promise.resolve()
            .then(() => docker.killContainer(delta.id))
            ;
    }

    function reloadConfig(delta)
    {
        var command = 'echo -n \'' + delta.config.haproxycfg + '\' > /etc/haproxy/haproxy.cfg';
        return docker.executeContainerCommand(delta.id, command);
    }

    function constructHAConfig(servers)
    {
        var sb = new StringBuilder();
        sb.append('global');
        sb.appendLine('    daemon');
        sb.appendLine('    maxconn 256');
        sb.appendLine();

        sb.appendLine('defaults');
        sb.appendLine('    mode http');
        sb.appendLine('    timeout connect 5000ms');
        sb.appendLine('    timeout client 50000ms');
        sb.appendLine('    timeout server 50000ms');
        sb.appendLine();

        sb.appendLine('frontend web');
        sb.appendLine('    bind *:80');
        sb.appendLine('    default_backend servers');
        sb.appendLine();

        sb.appendLine('backend servers');
        sb.appendLine('    balance roundrobin');
        var index = 0;
        for(var server of servers) {
            index++;
            sb.appendLine();
            sb.appendFormat('    server server{0} {1} maxconn 32', index, server);
        }
        sb.appendLine();

        return sb.toString();
    }

}
