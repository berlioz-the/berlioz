const Client = require('ssh2').Client;
const utils  = require('./utils');

module.exports = getClient;

let pwd;

function getClient(uri, opts) {
  const clientOpts = utils.getOptions(uri, opts);
  if (pwd && !clientOpts.password) {
    clientOpts.password = pwd;
  }
  if (clientOpts.askPassword) {
    return utils
      .askForPassword()
      .then(password => {
        clientOpts.password = password;
        pwd = password;
        return createClient(clientOpts);
      });
  }
  return createClient(clientOpts);
}

function createClient(clientOpts) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client.on('ready', () => {
      resolve(client);
    })
    .on('error', reject);
    return client
      .connect(clientOpts);
  });
}
