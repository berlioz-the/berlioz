var _classes = {
	fs	: require("fs"),
	fsu	: require(__dirname + "/../../lib.js")(['rmdirs']),
	path	: require("path")
};

var isEmpty	= function (path, callback) {
	_classes.fs.readdir(path, function (err, files) {
		if (err === null) {
			callback(null, !files.length)
		} else {
			callback(err);
		}
	});
};

isEmpty.sync = function (path) {
	var files = _classes.fs.readdirSync(path);
	return !files.length;
};

var emptyDir	= function (path, callback, opts) {
	_classes.fs.readdir(path, function (err, files) {
		if (!err) {
			var next	= function () {
				// console.log(files)
				if (Array.isArray(files) && files.length) {
					var file	= files.shift();
					_classes.fsu.rmdirs(_classes.path.join(path, file), function (err) {
						// console.log("\033[33m", _classes.path.join(path, file), err, "\033[0m");
						if (err) {
							callback(err);
						} else {
							next();
						}
					}, opts);
				} else {
					callback();
				}
			};
			next();
		} else {
			callback(err);
		}
	});
};

emptyDir.sync	= function (path) {
	var files = _classes.fs.readdirSync(path);
	var i;
	for (i=0;i<files.length;i++) {
		_classes.fsu.rmdirsSync(_classes.path.join(path, files[i]));
	}
	return !!files.length;
};

emptyDir.isEmpty	= isEmpty;

module.exports = emptyDir;