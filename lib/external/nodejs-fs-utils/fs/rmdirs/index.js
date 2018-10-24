var _classes = {
	fs	: require("fs"),
	path	: require("path")
};

var rmdirAsync = function(path, callback, opts) {
	path = _classes.path.normalize(path);
	var fs;
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

	var errors	= [];

	if (!fs)
		fs	= opts.fs || _classes.fs;
	fs[opts.symbolicLinks ? 'lstat' : 'stat'](path, function (err, stats) {
		if (err) {
			if (opts.skipErrors) {
				errors.push(err);
				callback(errors);
			} else {
				callback(err);
			}
		} else {
			if (!stats.isDirectory()) {
				fs.unlink(path, function (err) {
					if (err) {
						if (opts.skipErrors) {
							errors.push(err);
							callback(errors);
						} else {
							callback(err);
						}
					} else {
						callback();
					}
				});
			} else {
				fs.readdir(path, function(err, files) {
					if(err) {
						// Pass the error on to callback
						if (opts.skipErrors) {
							errors.push(err);
							callback(errors);
						} else {
							callback(err);
						}
						return;
					}
					// Remove one or more trailing slash to keep from doubling up
					path = path.replace(/\/+$/,"");
					var next	= function () {
						if (files.length) {
							var file	= files.shift();
							var curPath = _classes.path.normalize(path + _classes.path.sep + file);
							fs[opts.symbolicLinks ? 'lstat' : 'stat'](curPath, function(err, stats) {
								if( err || ( stats && stats.isSymbolicLink() )) {
									if (opts.skipErrors) {
										errors.push(err || Error("Exception: Symbolic link"));
										next();
									} else {
										callback(err || Error("Exception: Symbolic link"), []);
										return;
									}
								} else {
									if( stats.isDirectory() && !stats.isSymbolicLink() ) {
										rmdirAsync(curPath, function (err) {
											if (err) {
												if (opts.skipErrors) {
													errors.push(err);
													next();
												} else {
													callback(err);
												}
											} else {
												next();
											}
										}, opts);
									} else {
										fs.unlink(curPath, function (err) {
											if (err) {
												if (opts.skipErrors) {
													errors.push(err);
													next();
												} else {
													callback(err);
												}
											} else {
												next();
											}
										});
									}
								}
							});
						} else {
							fs.rmdir(path, function (err) {
								if (opts.skipErrors) {
									if (err) {
										errors.push(err);
									}
									callback(errors);
								} else {
									callback(err);
								}
							});
						}
					};
					next();
				});
			}
		}
	});

};

rmdirAsync.sync = function (path, opts) {
	var fs;
	path = _classes.path.normalize(path);
	if (typeof(opts) !== "object") {
		opts	= {};
	}

	if (typeof(opts.symbolicLinks) === "undefined") {
		opts.symbolicLinks	= true;
	}

	if (typeof(opts.skipErrors) === "undefined") {
		opts.skipErrors	= false;
	}

	if (!fs)
		fs	= opts.fs || _classes.fs;
	
	var err;
	try {
		var stats = fs[opts.symbolicLinks ? 'lstatSync' : 'statSync'](path);
	} catch (err) {
		if (!opts.skipErrors) {
			throw (err);
		} else {
			return;
		}
	}

	if (!stats.isDirectory()) {
		try {
			fs.unlink(path);
		} catch (err) {
			if (!opts.skipErrors) {
				throw (err);
			}
		}
		return;
	}

	var files;
	try {
		files	= fs.readdirSync(path);
	} catch (err) {
		if (!opts.skipErrors) {
			throw (err);
		}
	}
	var wait = files.length;
	
	// Remove one or more trailing slash to keep from doubling up
	path = path.replace(/\/+$/,"");
	files.forEach(function(file) {
		try {
			var curPath = _classes.path.normalize(path + _classes.path.sep + file);
			var stats = fs[opts.symbolicLinks ? 'lstatSync' : 'statSync'](curPath);

			if( stats.isDirectory() && !stats.isSymbolicLink() ) {
				rmdirAsync.sync(curPath, opts);
			} else {
				fs.unlinkSync(curPath);
			}
		} catch (err) {
			if (!opts.skipErrors) {
				throw (err);
			}
		}
	});
	fs.rmdirSync(path);
};

module.exports	= rmdirAsync;