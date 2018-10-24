var _classes = {
	fs	: require("fs"),
	path	: require("path")
};

var fsize = function(path, opts, callback) {
	var fs;
	var separator = _classes.path.sep;

	if (typeof(opts) === "function") {
		callback	= opts;
		opts	= {};
	}
	
	if (typeof(opts) !== "object") {
		opts	= {};
	}

	if (typeof(opts.symbolicLinks) === "undefined") {
		opts.symbolicLinks	= true;
	}

	if (typeof(opts.skipErrors) === "undefined") {
		opts.skipErrors	= false;
	}

	if (typeof(opts.logErrors) === "undefined") {
		opts.logErrors	= false;
	}

	if (typeof(opts.countFolders) === "undefined") {
		opts.countFolders	= true;
	}
	if (typeof(opts.countSymbolicLinks) === "undefined") {
		opts.countSymbolicLinks	= true;
	}

	if (!fs)
		fs	= opts.fs || _classes.fs;
	
	var count	= 0;
	var wait	= 0;
	var size	= 0;
	var errors	= [];
	var errorsSend	= false;
	var _next	= function (path) {
		if (errors.length && !opts.skipErrors) {
			if (!errorsSend) {
				errorsSend	= true;
				callback((opts.logErrors ? errors : errors[0]), size);
			}
			return;
		}
		if (path) {
			wait++;
			fs[opts.symbolicLinks ? 'lstat' : 'stat'](path, function(err, stats) {
				if (err) {
					if (opts.logErrors || !errors.length) {
						errors.push(err);
					}
					count++;
					_next();
				} else if (!stats.isDirectory() || stats.isSymbolicLink()) {
					if (opts.countSymbolicLinks || !stats.isSymbolicLink()) {
						size += stats.size;
					}
					count++;
					_next();
				} else {
					if (opts.countFolders) {
						size += stats.size;
					}
					fs.readdir(path, function(err, files) {
						if(err) {
							if (opts.logErrors || !errors.length) {
								errors.push(err);
							}
						} else {
							files.forEach(function (file) {
								_next(path + separator + file);
							});
						}
						count++;
						_next();
					});
				}
			});
		}
		if (count === wait) {
			callback((opts.logErrors ? errors : errors[0]), size);
		}
	};
	_next(path);
};

var fsizeSync = function(path, opts) {
	var fs;
	var separator = _classes.path.sep;

	if (typeof(opts) === "function") {
		callback	= opts;
		opts	= {};
	}
	
	if (typeof(opts) !== "object") {
		opts	= {};
	}

	if (typeof(opts.symbolicLinks) === "undefined") {
		opts.symbolicLinks	= true;
	}

	if (typeof(opts.skipErrors) === "undefined") {
		opts.skipErrors	= false;
	}

	if (typeof(opts.logErrors) === "undefined") {
		opts.logErrors	= false;
	}

	if (typeof(opts.countFolders) === "undefined") {
		opts.countFolders	= true;
	}
	if (typeof(opts.countSymbolicLinks) === "undefined") {
		opts.countSymbolicLinks	= true;
	}

	if (!fs)
		fs	= opts.fs || _classes.fs;
	
	var size	= 0;
	var errors	= [];
	var errorsSend	= false;
	var _next	= function (path) {
		if (errors.length && !opts.skipErrors) {
			throw(errors[0]);
		}
		if (path) {
			var er, err;
			var stats;
			try {
				stats = fs[opts.symbolicLinks ? 'lstatSync' : 'statSync'](path);
			} catch (er) {
				err = er;
			};

			if (err) {
				if (opts.logErrors || !errors.length) {
					errors.push(err);
					_next();
				}
			} else if (!stats.isDirectory() || stats.isSymbolicLink()) {
				if (opts.countSymbolicLinks || !stats.isSymbolicLink()) {
					size += stats.size;
				}
			} else {
				if (opts.countFolders) {
					size += stats.size;
				}
				err	= undefined;
				er	= undefined;
				var files;
				try {
					files = fs.readdirSync(path);
				} catch (er) {
					err	= er;
				};
				if(err) {
					if (opts.logErrors || !errors.length) {
						errors.push(err);
						_next();
					}
				} else {
					if (Array.isArray(files)) {
						files.forEach(function (file) {
							_next(path + separator + file);
						});
					}
				}
			}
		}
	};
	_next(path);

	opts.errors	= errors;

	return size;
};


fsize.fsize = fsize;
fsize.sync	= fsizeSync;

module.exports = fsize;