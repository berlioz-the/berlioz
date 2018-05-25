const getClient = require('./client');

module.exports = shell;

function shell(uri, opts, streamReadyCb) {
  return getClient(uri, opts)
    .then((client) => setupShell(client, opts, streamReadyCb));
}

function setRawMode(value) {
    if(process.stdin.isTTY) {
        process.stdin.setRawMode(value);
    }
}

function setupShell(client, opts, streamReadyCb) {
  return new Promise((resolve, reject) =>
    client.shell((err, stream) => {
      if (err) {
        reject(err);
      } else {
        // Piping
        setRawMode(true);
        process.stdin.pipe(stream);
        stream.pipe(process.stdout);
        stream.stderr.pipe(process.stderr);
        stream.setWindow(process.stdout.rows, process.stdout.columns);
        process.stdout.on('resize', () => {
          stream.setWindow(process.stdout.rows, process.stdout.columns);
        });

        // Retrieve keypress listeners
        const listeners = process.stdin.listeners('keypress');
        // Remove those listeners
        process.stdin.removeAllListeners('keypress');

        if (streamReadyCb) {
            var streamWrapper = {
                write: commands => {
                    if (!Array.isArray(commands)) {
                        commands = [commands];
                    }
                    var commandStr = commands.join('\n') + '\n';
                    stream._write(commandStr, null, () => {});
                }
            }
            streamReadyCb(streamWrapper);
        }

        stream.on('close', () => {
          // Release stdin
          setRawMode(false);
          process.stdin.unpipe(stream);
          if (!opts.preserveStdin) {
            process.stdin.unref();
          }
          // Restore listeners
          listeners.forEach(listener => process.stdin.addListener('keypress', listener));
          // End connection
          client.end();
          resolve();
        });
      }
    })
  );
}
