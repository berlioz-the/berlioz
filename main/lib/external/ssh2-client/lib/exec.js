const getClient = require('./client');

module.exports = exec;

function exec(uri, cmd, opts) {
  return getClient(uri, opts)
    .then(client => execCmd(client, cmd));
}

function execCmd(client, cmd) {
  return new Promise((resolve, reject) =>
    client.exec(cmd, (err, stream) => {
      if (err) {
        reject(err);
      } else {
        let out = '';
        let error = '';
        stream.stderr.pipe(process.stderr);
        stream.on('data', output => {
          out += output;
        });
        stream.stderr.on('data', data => {
          error += data;
        });
        stream.on('close', () => {
          client.end();
          resolve({
            out,
            error
          });
        });
      }
    })
  );
}
