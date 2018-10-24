var _classes = {
	fs	: require("fs"),
	fsu	: require(__dirname + "/../../lib.js")(['copy', 'rmdirs']),
	path	: require("path")
};

var moveFile = function (path_source, path_dest, callback) {
	var err, callback_sent	= false;
	try {
		var source = _classes.fs.createReadStream(path_source);
		var dest = _classes.fs.createWriteStream(path_dest);
		source.pipe(dest);
		source.on('end', function() {
			if (!callback_sent) {
				callback();
			}
		});
		source.on('error', function(err) {
			if (!callback_sent) {
				callback();
			}
		});
	} catch (err) {
		if (!callback_sent) {
			callback();
		}
	}
};

var move	= function (oldPath, newPath, callback, opts) {
	_classes.fs.rename(oldPath, newPath, function (err) {
		if (err) {
			if (err.code === 'EXDEV') {
				// copy and unlink
				_classes.fsu.copy(oldPath, newPath, function (err, cache) {
					if (err && !Array.isArray(err)) {
						callback(err);
					} else {
						_classes.fsu.rmdirs(oldPath);
					}
				}, opts);
			} else {
				callback(err);
			}
			return;
		} else {
			callback();
		}
	});
};

move.sync	= function (oldPath, newPath, opts) {
	var err;
	try {
		_classes.fs.renameSync(oldPath, newPath);
	} catch(err) {
		if (err) {
			if (err.code === 'EXDEV') {
				// copy and unlink
				_classes.fsu.copySync(oldPath, newPath, function (err, cache) {
					if (err && !Array.isArray(err)) {
						throw err;
					} else {
						_classes.fsu.rmdirsSync(oldPath);
					}
				}, opts);
			} else {
				throw err;
			}
		}
	};
};

module.exports	= move;