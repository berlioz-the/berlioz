const Promise = require('the-promise');
const _ = require('the-lodash');

module.exports = (section, logger, {docker, helper, cluster}) => {

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
                }
            };
            config.isAgent = ('berlioz:agent' in config.labels);

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
            return config;
        })
        .onExtractRelations(item => {
            item.inverseRelation('ready-task', item.naming)
                .setupSourceAutoCreate();
        })
        .onAutoConfig((item, action) => {
            if (action == 'delete') {
                return true;
            }

            if (item.config.isAgent) {
                return true;
            }

            var agentTask = _(item.findRelations('task')).map(x => x.targetItem).find(x => x.config.isAgent);
            if (agentTask) {
                var agentIp = helper.getContainerIp(agentTask.obj);
                if (agentIp) {
                    item.config.environment['BERLIOZ_AGENT_PATH'] = 'ws://' + agentIp + ':55555/' + item.config.taskId;
                    return true;
                }
            }

            return false;
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
        logger.info('[startTask] dn: %s', delta.dn);

        var labels = _.clone(delta.config.labels);
        labels['berlioz:environment'] = JSON.stringify(delta.config.environment);

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
                PortBindings: {}
            },
            Env: []
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
        logger.info('[stopTask] dn: %s', delta.dn);
        return Promise.resolve()
            .then(() => {
                return helper._taskMetaStore.deleteTask(delta.dn);
            })
            .then(() => docker.stopContainer(delta.id))
            ;
    }


}
