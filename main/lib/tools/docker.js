const DockerLib = require('dockerode');
const _ = require('the-lodash');
const Promise = require('the-promise');

class Docker
{
    constructor(logger)
    {
        this._logger = logger;
        this._docker = new DockerLib();
    }

    listContainers()
    {
        return this._docker.listContainers()
            .then(containers => Promise.serial(containers, x => this._docker.getContainer(x.Id).inspect()));
    }

    listContainersByKind(labelFilters)
    {
        return this.listContainers()
            .then(containers => containers.filter(x => {
                if (!labelFilters) {
                    return true;
                }
                return _.every(_.keys(labelFilters), key => {
                    return x.Config.Labels[key] == labelFilters[key];
                });
            }));
    }

    queryContainer(id)
    {
        var container = this._docker.getContainer(id);
        return container.inspect();
    }

    pullImage(imageName)
    {
        return new Promise((resolve, reject) => {
            return this._docker.pull(imageName + ':latest')
                .then(stream => {
                    stream.pipe(process.stdout);
                    stream.on('end', () => {
                        resolve();
                    })
                    // stream.on('data', chunk => {
                    //     console.log(chunk.toString());
                    // })
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    startContainer(config)
    {
        return this._docker.createContainer(config)
            .then((container) => {
                // logger.info('[startTask] Starting container %s: ', delta.dn, containerConfig);
                return container.start();
            })
            .then(result => {
                // logger.info('[startTask] Container started %s: ', delta.dn, result);
                return result.inspect();
            })
            .then(result => {
                this._logger.info('[startTask] Inspected container: ', result);
                return result;
            })
            ;
    }

    stopContainer(id)
    {
        var container = this._docker.getContainer(id);
        return Promise.resolve()
            .then(() => container.stop())
            .then(() => container.remove())
            ;
    }

    executeContainerCommand(id, command)
    {
        var commandToRun = ['bash', '-c', command];
        var container = this._docker.getContainer(id);
        return new Promise((resolve, reject) => {
            var options = {
                Cmd: commandToRun,
            };
            container.exec(options, (err, exec) => {
                if (err) {
                    reject(err);
                    return;
                }
                exec.start((err, stream) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // container.modem.demuxStream(stream, process.stdout, process.stderr);
                    //
                    // exec.inspect((err, data) => {
                    //     if (err) {
                    //         reject(err);
                    //         return;
                    //     }
                    //     console.log(data);
                    // });
                    resolve();
                });
            });
        });
    }

    getImage(name)
    {
        var image = this._docker.getImage(name);
        return image.inspect()
            .then(result => {
                return result;
            })
    }
}

module.exports = Docker;
