const DockerLib = require('dockerode');
const _ = require('the-lodash');
const Promise = require('the-promise');
const URL = require('url-parse');
const fs = require('fs');
const Path = require('path');

class Docker
{
    constructor(logger, screen, shell)
    {
        this._logger = logger;
        this._screen = screen;
        this._shell = shell;
        this._isInsideMicrosoftUbuntu = false;
        var res = this._shell.shell.exec('uname -r', { async: false, silent: true });
        if (res.code == 0) {
            if (_.includes(res.stdout, 'Microsoft')) {
                this._isInsideMicrosoftUbuntu = true;
                screen.info('Running in Windows Bash.')
                screen.info('Makes you enable \"Expose deamon on tcp://localhost:2375 without TLS\" setting.')
            }
        }

        this._connectionArgument = ' '
        this._dockerConnectOptions = null
        this._getHostConfig()
        this._getTlsConfig()
        
        this._logger.info('Docker Connect Options: ', this._dockerConnectOptions);
        this._logger.info('Connection Argument: %s', this._connectionArgument);

        this._docker = new DockerLib(this._dockerConnectOptions);
    }

    _getHostConfig()
    {
        if (process.env.DOCKER_HOST) {
            var url = new URL(process.env.DOCKER_HOST);
            if (!this._dockerConnectOptions) {
                this._dockerConnectOptions = {}
            }
            this._dockerConnectOptions.host = url.hostname;
            if (url.port) {
                this._dockerConnectOptions.port = url.port;
            }
        } else if (this._isInsideMicrosoftUbuntu) {
            if (!this._dockerConnectOptions) {
                this._dockerConnectOptions = {}
            }
            this._dockerConnectOptions.host = '127.0.0.1';
            this._dockerConnectOptions.port = 2375;
        }

        if (this._dockerConnectOptions) {
            if (this._dockerConnectOptions.host) {
                var commandHostUrl = 'tcp://' + this._dockerConnectOptions.host;
                if (this._dockerConnectOptions.port)
                {
                    commandHostUrl += ':' + this._dockerConnectOptions.port;
                }
                this._connectionArgument += '-H ' + commandHostUrl + ' ';
            }
        }
          
    }

    _getTlsConfig()
    {
        if (process.env.DOCKER_TLS_VERIFY == 1) {
            this._connectionArgument += '--tlsverify '
        }

        if (process.env.DOCKER_CERT_PATH) {
            if (!this._dockerConnectOptions) {
                this._dockerConnectOptions = {}
            }
            var filePath = Path.join(process.env.DOCKER_CERT_PATH, 'ca.pem')
            this._dockerConnectOptions.ca = fs.readFileSync(filePath);
            this._connectionArgument += '--tlscacert ' + filePath + ' '
    
            filePath = Path.join(process.env.DOCKER_CERT_PATH, 'cert.pem')
            this._dockerConnectOptions.cert = fs.readFileSync(filePath);
            this._connectionArgument += '--tlscert ' + filePath + ' '
    
            filePath = Path.join(process.env.DOCKER_CERT_PATH, 'key.pem')
            this._dockerConnectOptions.key = fs.readFileSync(filePath);
            this._connectionArgument += '--tlskey ' + filePath + ' '
        }
    }

    _isInsideMicrosoftUbuntu()
    {
        var res = this._shell.shell.exec('uname -r', { async: false, silent: true });
        if (res.code == 0) {
            if (_.includes(res.stdout, 'Microsoft')) {
                return true;
                dockerConnectOptions = {
                    host: '0.0.0.0',
                    port: 2375
                }
                this._connectionArgument = '-H tcp://' + dockerConnectOptions.host + ':' + dockerConnectOptions.port + ' ';

                screen.info('Running in Windows Bash. Makes sure to expose port %s in docker settings.', dockerConnectOptions.port)
            }
        }
    }

    isDockerRunning()
    {
        return this._docker.info()
            .catch(error => {
                if (error.code == 'ENOENT') {
                    return null;
                } else {
                    this._logger.error('Docker error: ', error);
                }
            });
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

    pullImage(imageName, skipIfExists)
    {
        var actualImage = imageName + ':latest';

        if (skipIfExists)
        {
            this._screen.info('Checking image %s...', imageName);
            return this.getImage(imageName)
                .then(res => {
                    if (!res) {
                        return this._pull(actualImage);
                    }
                });
        }
        else
        {
            return this._pull(actualImage);
        }
    }

    _pull(imageName)
    {
        this._screen.info('Pulling image %s...', imageName);
        return this.command('pull ' + imageName);
    }

    command(command)
    {
        return this._shell.run('docker ' + this._connectionArgument + command);
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

    killContainer(id)
    {
        var container = this._docker.getContainer(id);
        return Promise.resolve()
            .then(() => container.kill())
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
            .catch(reason => {
                if (reason.statusCode == 404) {
                    return null;
                } else {
                    return Promise.reject(reason);
                }
            })
    }
}

module.exports = Docker;
