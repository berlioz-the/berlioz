# Preparing Ubuntu 14.04
Follow the steps below to prepare the workstation.

## Setup NodeJS
You would need this to run berlioz command line tool.
```
$ curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
$ sudo apt-get install -y nodejs build-essential
```
Release Note: In case you see "*gyp WARN EACCES attempting to reinstall using temporary dev dir*" errors please press Ctrl-C, and ignore the error.

## Setup Docker
You would need this to build images and run applications locally.
```
$ wget -qO- https://get.docker.com/ | sh
$ sudo usermod -aG docker $(whoami)
$ sudo apt-get -y install python-pip
$ sudo pip install docker-compose
```
After this reboot your system (or logout).

## Setup Git
You would need this to download our samples repository.
```
$ sudo apt-get -y install git
```
