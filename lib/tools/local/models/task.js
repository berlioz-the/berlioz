const Promise = require('the-promise');
const _ = require('the-lodash');

module.exports = (section, logger, {docker, helper, cluster, screen}) => {

    section
        .onQueryAll(() => docker.listContainersByKind({
            'berlioz:kind': 'task',
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
                imageId: obj.Image,
                environment: {},
                ports: {
                    tcp: {},
                    udp: {}
                },
                binds: []
            };

            if (config.labels['berlioz:environment'])
            {
                config.environment = JSON.parse(config.labels['berlioz:environment']);
                delete config.labels['berlioz:environment'];
            }

            for(var binding of helper.parseContainerPortBingings(obj))
            {
                config.ports[binding.protocol][binding.port] = binding.hostPort;
            }
            config.taskId = config.environment['BERLIOZ_TASK_ID'];
            config.image = obj.Config.Image;
            config.ipAddress = _.get(obj, "NetworkSettings.Networks.berlioz.IPAddress", "");

            if (obj.HostConfig.Binds) {
                config.binds = obj.HostConfig.Binds
            }

            return config;
        })
        .onExtractRelations(item => {
            item.inverseRelation('ready-task', item.naming)
                .setupSourceAutoCreate();
        })
        .onAutoConfig((item, action) => {
            logger.info('TASK::onAutoConfig %s...', item.dn);

            if (action == 'delete') {
                return true;
            }

            item.config.environment['BERLIOZ_AGENT_PATH'] = 'ws://' + helper.agentHostPort + '/' + item.config.taskId;
            return true;
        })
        .onCreate(delta => {
            return startTask(delta);
        })
        .onDelete(delta => {
            return stopTask(delta);
        })
        .onUpdateRecreate(() => true)
        ;

    function startTask(delta)
    {
        screen.info('Starting %s...', delta.dn);
        logger.info('[startTask] dn: %s', delta.dn);

        var labels = _.clone(delta.config.labels);
        labels['berlioz:environment'] = JSON.stringify(delta.config.environment);

        var networkConfig = {
            IPAMConfig: {
                IPv4Address: delta.config.ipAddress
            },
            Aliases: []
        }
        {
            var parts = [
                delta.naming[2] + '_' + delta.naming[3],
                delta.naming[1],
                delta.naming[0]
            ];
            parts = parts.map(x => _.replaceAll(x, '-', '_'));
            var alias = parts.join(".");
            networkConfig.Aliases.push(alias);
        }

        var containerConfig = {
            AttachStdin: false,
            AttachStdout: false,
            AttachStderr: false,
            Tty: false,
            OpenStdin: false,
            StdinOnce: false,

            // Name: delta.config.name,
            Image: delta.config.image,
            Labels: labels,
            ExposedPorts: {},
            HostConfig: {
                PortBindings: {},
                SecurityOpt: ["apparmor:unconfined"],
                Binds: delta.config.binds
            },
            NetworkingConfig: {
                EndpointsConfig: {
                    berlioz: networkConfig
                }
            },
            Env: [],
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
        for(var envName of _.keys(delta.config.environment))
        {
            containerConfig.Env.push(envName + '=' + delta.config.environment[envName]);
        }
        logger.info('[startTask] Creating task container %s: ', delta.dn, containerConfig);
        return Promise.resolve()
            .then(() => docker.startContainer(containerConfig))
            ;
    }

    function stopTask(delta)
    {
        screen.info('Stopping %s...', delta.dn);

        logger.info('[stopTask] dn: %s', delta.dn);
        return Promise.resolve()
            .then(() => docker.killContainer(delta.id))
            ;
    }


}
