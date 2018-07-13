# Preparing Ubuntu 14.04
Follow the steps below to prepare the workstation.

## Setup NodeJS
```
$ curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
$ sudo apt-get install -y nodejs build-essential
```
Release Note: In case you see "*gyp WARN EACCES attempting to reinstall using temporary dev dir*" errors please press Ctrl-C, and ignore the error.

## Setup Docker
```
$ wget -qO- https://get.docker.com/ | sh
$ sudo usermod -aG docker $(whoami)
$ sudo apt-get -y install python-pip
$ sudo pip install docker-compose
```
After this reboot your system (or logout).
