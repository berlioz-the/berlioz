#!/usr/bin/env node

const logger = require('the-logger').setup('berlioz', {
    enableFile: false,
    cleanOnStart: false,
    pretty: true
});
logger.level = 'error';

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
