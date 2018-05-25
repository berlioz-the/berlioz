const fs       = require('fs');
const inquirer = require('inquirer');

module.exports = {
  askForPassword,
  getOptions
};

function askForPassword() {
  return inquirer.prompt([{
    type    : 'password',
    name    : 'password',
    message : 'Input password'
  }]).then(answers => answers.password);
}

function getOptions(uri, opts = {}) {
  const envOpts    = parseUri(uri);
  opts.username    = opts.username || envOpts.username;
  opts.host        = opts.host || envOpts.host;
  // FIXME Not working with dsa keys
  if (opts.privateKey && !opts.privateKey.indexOf('dsa') > -1) {
    opts.privateKey = fs.readFileSync(opts.privateKey).toString('utf-8');
  }
  // Use SSH-Agent
  if (!opts.agent && process.env.SSH_AUTH_SOCK) {
    opts.agent = process.env.SSH_AUTH_SOCK;
  }
  if (opts.agent) {
    opts.agentForward = true;
  }
  return opts;
}

/**
* Parse : username@host AND host
*/
function parseUri(uri) {
  const opts = {};
  const [username, host] = uri.split('@');
  opts.host = host || username;
  opts.username = host ? username : null;
  return opts;
}
