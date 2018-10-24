var _classes = {
	fs	: require("fs"),
	fsu	: require(__dirname + "/../../lib.js")(['mkdirs']),
	path	: require("path")
};

var createFile	= function (path, opts, callback) {
	var file	= _classes.path.normalize(path);
	var dir		= _classes.path.dirname(file);
	if (typeof(opts) === "function") {
		callback	= opts;
		opts		= undefined;
	}
	_classes.fs.stat(file, function (err, stats) {
		if (err) {
			_classes.fsu.mkdirs(dir, function (err) {
				if (err) {
					callback(err);
				} else {
					_classes.fs.open(file, 'a', function (err, fd) {
						if (err) {
							callback(err);
						} else {
							_classes.fs.close(fd, callback);
						}
					});
				}
			});
		} else {
			if (stats.isFile()) {
				// already exists
				callback();
			} else {
				callback(Error("NONFILE_ALREADY_EXISTS"));
			}
		}
	});
};

createFile.sync	= function (path, opts) {
	var file	= _classes.path.normalize(path);
	var dir		= _classes.path.dirname(file);
	if (typeof(opts) === "function") {
		callback	= opts;
		opts		= undefined;
	}
	var err;
	try {
		var stats	= _classes.fs.statSync(file);
		if (stats.isFile()) {
			// already exists
		} else {
			throw Error("NONFILE_ALREADY_EXISTS");
		}
	} catch (err) {
		_classes.fsu.mkdirsSync(dir);
		_classes.fs.closeSync(_classes.fs.openSync(file, 'a'));
	}
};

module.exports	= {
	createFile	: createFile
};