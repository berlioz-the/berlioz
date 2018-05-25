#!/usr/bin/env node

const logger = require('the-logger').setup('bunyan', 'berlioz', {
    enableFile: true,
    path: 'logs_berlioz',
    cleanOnStart: true,
    pretty: true
});
var logLevel = 'info';
logLevel = 'verbose';
logger.level = logLevel;

var rootDir = process.cwd();
logger.verbose('Root Dir: %s', rootDir);

var args = process.argv.splice(2);
var argStr = args.join(' ');
logger.verbose('ArgStr: %s', argStr);

const Starter = require('../lib/starter');
var starter = new Starter(logger, rootDir);
return starter.run(argStr)
    .catch(error => {
        logger.error(error);
    });
