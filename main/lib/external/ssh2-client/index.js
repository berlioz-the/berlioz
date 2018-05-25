const path  = require('path');

const exec  = require(path.join(__dirname, '/lib/exec'));
const shell = require(path.join(__dirname, './lib/shell'));

module.exports = {
  exec,
  shell
};
