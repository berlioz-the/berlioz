var _classes = {
	fs	: require("fs"),
	fsu	: require(__dirname + "/../../lib.js")(['walk', 'mkdirs']),
	path	: require("path")
};

var copyFile	= function (source, target, cb) {
	var cbCalled = false;
	// console.log(source, " » ", target);
	var rd = _classes.fs.createReadStream(source);
	rd.on("error", function(err) {
		done(err, "read-error");
	});
	var wr = _classes.fs.createWriteStream(target);
	wr.on("error", function(err) {
		done(err, "write-error");
	});
	wr.on("close", function(ex) {
		done(undefined, "close");
	});
	rd.pipe(wr);

	function done(err, eventType) {
		if (!cbCalled) {
			cbCalled = true;
			cb(err);
		}
	}
};
var copyFileSync	= function (srcFile, destFile) {
	var BUF_LENGTH, buff, bytesRead, fdr, fdw, pos;
	BUF_LENGTH = 64 * 1024;
	buff = new Buffer(BUF_LENGTH);
	fdr = _classes.fs.openSync(srcFile, 'r');
	fdw = _classes.fs.openSync(destFile, 'w');
	bytesRead = 1;
	pos = 0;
	while (bytesRead > 0) {
		bytesRead = _classes.fs.readSync(fdr, buff, 0, BUF_LENGTH, pos);
		_classes.fs.writeSync(fdw, buff, 0, bytesRead);
		pos += bytesRead;
	}
	_classes.fs.closeSync(fdr);
	return _classes.fs.closeSync(fdw);
};

var path_dest	= function (source, dest, path, mode) {
	// mode "auto", "none", "relative", "absolute"
	// TODO mode: relative absolute auto none
	// console.log("\033[7m",source, '../', dest, path, "\033[0m");
	// console.log("\033[7;32m",_classes.path.resolve(_classes.path.resolve(source, '../', dest), _classes.path.relative(source, path)), "\033[0m");
	var destPathAbsolute	= _classes.path.resolve(_classes.path.resolve(source, '../', dest), _classes.path.relative(source, path));
	if (mode === "absolute") {
		return destPathAbsolute;
	} else if (mode === "relative") {
		return _classes.path.relative(source, destPathAbsolute);
	} else if (mode === "none") {
		if (isSymbolicLink) {
			return destPathAbsolute;
		} else {
			return destPathAbsolute;
		}
	}
	return destPathAbsolute;
};

var copy = function(path_source, dest, callback, opts) {
	path_source = _classes.path.normalize(path_source);
	dest = _classes.path.normalize(dest);
	var separator = _classes.path.sep;

	if (typeof(opts) !== "object") {
		opts	= {};
	}
	if (typeof(opts.symlinksKeep) === "undefined") {
		// file / directory / all
		opts.keepSymlinks	= "all";
	} else if (["file", "directory", "all"].indexOf(opts.keepSymlinks) === -1) {
		opts.keepSymlinks	= "all";
	}
	if (typeof(opts.symlinksNormalize) === "undefined") {
		// auto / none / relative / absolute
		opts.symlinksNormalize	= "auto";
	} else if (["auto", "none", "relative", "absolute"].indexOf(opts.symlinksNormalize) === -1) {
		opts.symlinksNormalize	= "auto";
	}
	if (typeof(opts.linkFiles) === "undefined") {
		// auto / none / relative / absolute
		opts.linkFiles	= "none";
	} else if (["auto", "none", "relative", "absolute"].indexOf(opts.linkFiles) === -1) {
		opts.linkFiles	= "none";
	}
	_classes.fsu.walk(path_source, opts, function (err, path, stats, next, cache) {
		if (!stats) {
			if (err) {
				cache.errors.push(new Error("Falied to copy Error", { stats: stats, path: path, err: err }));
			}
			next();
		} else if (stats.isDirectory()) {
			_classes.fsu.mkdirs(path_dest(path_source, dest, path), function (err) {
				if (err) {
					cache.errors.push(new Error("Falied to copy [Directory]", { stats: stats, path: path, dest: dest, err: err }));
				}
				next();
			});
		} else if (stats.isSymbolicLink()) {
			var symPath	= undefined;
			_classes.fs.stat(path, function (err, stats) {
				if (err) {
					next();
				} else {
					if (stats.isDirectory()) {
						if (opts.keepSymlinks === "directory" || opts.keepSymlinks === "all") {
							_classes.fs.symlink(path, path_dest(path_source, dest, path, opts.symlinksNormalize), 'dir', function (err) {
								if (err) {
									cache.errors.push(new Error("Falied to link [Directory]", { stats: stats, path: path, dest: dest, err: err }));
								}
								next();
							});
						} else {
							_classes.fsu.mkdirs(path_dest(path_source, dest, path), function (err) {
								if (err) {
									cache.errors.push(new Error("Falied to copy [Directory]", { stats: stats, path: path, dest: dest, err: err }));
								}
								next();
							});
						}
					} else {
						// for file and other types
						if (opts.keepSymlinks === "file" || opts.keepSymlinks === "all") {
							_classes.fs.symlink(path, path_dest(path_source, dest, path, opts.symlinksNormalize), 'file', function (err) {
								if (err) {
									cache.errors.push(new Error("Falied to link [File]", { stats: stats, dest: dest, path: path, err: err }));
								}
								next();
							});
						} else {
							copyFile(path, path_dest(path_source, dest, path), function (err) {
								if (err) {
									cache.errors.push(new Error("Falied to copy [File]", { stats: stats, dest: dest, path: path, err: err }));
								}
								next();
							});
						}
					}
				}
			});
			// cache.errors.push(new Error("Falied to copy [SymbolicLink]", { stats: stats, path: path }));
		} else if (stats.isFile()) {
			if (opts.linkFiles !== "none") {
				_classes.fs.symlink(path, path_dest(path_source, dest, path, opts.linkFiles), 'file', function (err) {
					if (err) {
						cache.errors.push(new Error("Falied to link [File]", { stats: stats, dest: dest, path: path, err: err }));
					}
					next();
				});
			} else {
				copyFile(path, path_dest(path_source, dest, path), function (err) {
					if (err) {
						cache.errors.push(new Error("Falied to copy [File]", { stats: stats, dest: dest, path: path, err: err }));
					}
					next();
				});
			}
		} else if (stats.isBlockDevice()) {
			cache.errors.push(new Error("Falied to copy [BlockDevice]", { stats: stats, path: path }));
			next();
		} else if (stats.isCharacterDevice()) {
			cache.errors.push(new Error("Falied to copy [CharacterDevice]", { stats: stats, path: path }));
			next();
		} else if (stats.isFIFO()) {
			cache.errors.push(new Error("Falied to copy [FIFO]", { stats: stats, path: path }));
			next();
		} else if (stats.isSocket()) {
			cache.errors.push(new Error("Falied to copy [Socket]", { stats: stats, path: path }));
			next();
		} else {
			cache.errors.push(new Error("Falied to copy [Unknown]", { stats: stats, path: path }));
			next();
		}
	}, function (errors, cache) {
		callback(errors, cache);
	});
};

var copySync = function(path_source, dest, callback, opts) {
	path_source = _classes.path.normalize(path_source);
	dest = _classes.path.normalize(dest);
	var separator = _classes.path.sep;

	if (typeof(opts) !== "object") {
		opts	= {};
	}
	if (typeof(opts.symlinksKeep) === "undefined") {
		// file / directory / all
		opts.keepSymlinks	= "all";
	} else if (["file", "directory", "all"].indexOf(opts.keepSymlinks) === -1) {
		opts.keepSymlinks	= "all";
	}
	if (typeof(opts.symlinksNormalize) === "undefined") {
		// auto / none / relative / absolute
		opts.symlinksNormalize	= "auto";
	} else if (["auto", "none", "relative", "absolute"].indexOf(opts.symlinksNormalize) === -1) {
		opts.symlinksNormalize	= "auto";
	}
	if (typeof(opts.linkFiles) === "undefined") {
		// auto / none / relative / absolute
		opts.linkFiles	= "none";
	} else if (["auto", "none", "relative", "absolute"].indexOf(opts.linkFiles) === -1) {
		opts.linkFiles	= "none";
	}
	_classes.fsu.walkSync(path_source, opts, function (err, path, stats, next, cache) {
		if (!stats) {
			if (err) {
				cache.errors.push(new Error("Falied to copy Error", { stats: stats, path: path, err: err }));
			}
			next();
		} else if (stats.isDirectory()) {
			try {
				_classes.fsu.mkdirsSync(path_dest(path_source, dest, path));
			} catch (err) {
				cache.errors.push(new Error("Falied to copy [Directory]", { stats: stats, path: path, dest: dest, err: err }));
			}
			next();
		} else if (stats.isSymbolicLink()) {
			var symPath	= undefined;
			try {
				stats = _classes.fs.statsSync(path);

				if (stats.isDirectory()) {
					if (opts.keepSymlinks === "directory" || opts.keepSymlinks === "all") {
						try {
							_classes.fs.symlinkSync(path, path_dest(path_source, dest, path, opts.symlinksNormalize), 'dir');
						} catch (err) {
							cache.errors.push(new Error("Falied to link [Directory]", { stats: stats, path: path, dest: dest, err: err }));
						}
						next();
					} else {
						try {
							_classes.fsu.mkdirsSync(path_dest(path_source, dest, path));
						} catch (err) {
							cache.errors.push(new Error("Falied to copy [Directory]", { stats: stats, path: path, dest: dest, err: err }));
						}
						next();
					}
				} else {
					// for file and other types
					if (opts.keepSymlinks === "file" || opts.keepSymlinks === "all") {
						try {
							_classes.fs.symlinkSync(path, path_dest(path_source, dest, path, opts.symlinksNormalize), 'file');
						} catch (err) {
							cache.errors.push(new Error("Falied to link [File]", { stats: stats, dest: dest, path: path, err: err }));
						}
						next();
					} else {
						try {
							copyFileSync(path, path_dest(path_source, dest, path));
						} catch (err) {
							cache.errors.push(new Error("Falied to copy [File]", { stats: stats, dest: dest, path: path, err: err }));
						}
						next();
					}
				}
			} catch (err) {
				cache.errors.push(new Error("Falied to copy Error", { stats: stats, path: path, err: err }));
				next();
			}
			return;
			// cache.errors.push(new Error("Falied to copy [SymbolicLink]", { stats: stats, path: path }));
		} else if (stats.isFile()) {
			if (opts.linkFiles !== "none") {
				try {
					_classes.fs.symlinkSync(path, path_dest(path_source, dest, path, opts.linkFiles), 'file');
				} catch (err) {
					cache.errors.push(new Error("Falied to link [File]", { stats: stats, dest: dest, path: path, err: err }));
				}
				next();
			} else {
				try {
					copyFileSync(path, path_dest(path_source, dest, path));
				} catch (err) {
					cache.errors.push(new Error("Falied to copy [File]", { stats: stats, dest: dest, path: path, err: err }));
				}
				next();
			}
		} else if (stats.isBlockDevice()) {
			cache.errors.push(new Error("Falied to copy [BlockDevice]", { stats: stats, path: path }));
			next();
		} else if (stats.isCharacterDevice()) {
			cache.errors.push(new Error("Falied to copy [CharacterDevice]", { stats: stats, path: path }));
			next();
		} else if (stats.isFIFO()) {
			cache.errors.push(new Error("Falied to copy [FIFO]", { stats: stats, path: path }));
			next();
		} else if (stats.isSocket()) {
			cache.errors.push(new Error("Falied to copy [Socket]", { stats: stats, path: path }));
			next();
		} else {
			cache.errors.push(new Error("Falied to copy [Unknown]", { stats: stats, path: path }));
			next();
		}
	}, function (errors, cache) {
		callback(errors, cache);
	});
};


copy.copy	= copy;
copy.sync	= copySync;

module.exports = copy;