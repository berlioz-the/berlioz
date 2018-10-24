const slash = require('slash');
var _classes = {
	fs	: require("fs"),
	path	: require("path")
};

function isMatch(path, filters) 
{
    var xPath = slash(path);
    if (filters) {
        for(var re of filters) {
            if (!xPath.match(re)) {
                return false;
            }
        }
    }
    return true;
}

var walk = function(path, opts, callback, onend_callback) {
	path = _classes.path.normalize(path);
	var fs;
	var separator = _classes.path.sep;

    var filters = [];
    if (opts.filter) {
        for(var x of opts.filter) {
            if (typeof stringValue == "string") {
                filters.push(new RegExp(x, "g"));
            } else {
                filters.push(x);
            }
        }
    }

	if (typeof(opts) === "function") {
		callback	= opts;
		opts	= {};
		if (typeof(callback) === "function") {
			onend_callback	= callback;
		}
	}

	if (typeof(onend_callback) !== "function") {
		onend_callback	= function () {};
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

	if (typeof(opts.stackPushEnd) === "undefined") {
		opts.stackPushEnd	= false;
	}

	if (!fs) {
		fs	= opts.fs || _classes.fs;
	}

	var cache	= {
		stack   : [],
		count	: 0,
		get wait() {
			return cache.stack.length;
		},
		files	: 0,
		dirs	: 0,
		fsnodes	: 0,
		errors	: []
	};
	var finalCallback	= false;
	var fnc	= 0;
	var errorsSend	= false;

    var _addToStack = function(path, file) {
        var newPath = _classes.path.join(path, file);
        if (!isMatch(newPath, filters)) {
            return;
        }
        if (opts.stackPushEnd) {
            cache.stack.push(newPath);
        } else {
            cache.stack.unshift(newPath);
        }
    }

	var _tick	= function () {
		if (cache.errors.length && !opts.skipErrors) {
			if (!errorsSend) {
				errorsSend	= true;
				if (!finalCallback) {
					finalCallback = true;
					onend_callback((opts.logErrors ? cache.errors : cache.errors[0]), cache);
				}
			}
			return;
		} else if (cache.stack.length === 0) {
			if (!finalCallback) {
				finalCallback = true;
				onend_callback((opts.logErrors ? cache.errors : cache.errors[0]), cache);
			}
		} else {
			var path = cache.stack.shift();
			cache.fsnodes++;
			fs[opts.symbolicLinks ? 'lstat' : 'stat'](path, function(err, stats) {
				if (err) {
					if (opts.logErrors || !cache.errors.length) {
						cache.errors.push(err);
					}
					callback(err, path, stats, _tick, cache);
				} else if (!stats.isDirectory() || stats.isSymbolicLink()) {
					cache.count++;
					cache.files++;
					callback(err, path, stats, _tick, cache);
				} else {
                    if (!isMatch(path, filters)) {
                        return
                    }
					cache.count++;
					cache.dirs++;
					fs.readdir(path, function(err, files) {
						if(err) {
							if (opts.logErrors || !cache.errors.length) {
								cache.errors.push(err);
							}
						} else {
                            files.forEach(function (file) {
                                _addToStack(path, file);
                            });
						}
						callback(err, path, stats, _tick, cache);
					});
				}
			});
		}
	};

	cache.stack.push(path);
	_tick();
};

var walkSync = function(path, opts, callback, onend_callback) {
	path = _classes.path.normalize(path);
	var fs;
	var separator = _classes.path.sep;


	if (typeof(opts) === "function") {
		callback	= opts;
		opts	= {};
		if (typeof(callback) === "function") {
			onend_callback	= callback;
		}
	}

	if (typeof(onend_callback) !== "function") {
		onend_callback	= function () {};
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

	if (!fs)
		fs	= opts.fs || _classes.fs;
	
	var cache	= {
		files	: 0,
		dirs	: 0,
		fsnodes	: 0,
		errors	: []
	};

	var errorsSend	= false;
	var _tick	= function (err, path, stats, next) {
		if (cache.errors.length && !opts.skipErrors) {
			throw(cache.errors[0]);
		} else if (next) {
			callback(err, path, stats, next, cache);
		}
	};
	var _next_empty	= function () {};
	var _next	= function (path) {
		if (path) {
			var er, err;
			var stats;
			try {
				stats = fs[opts.symbolicLinks ? 'lstatSync' : 'statSync'](path);
			} catch (er) {
				err = er;
			};

			if (err) {
				if (opts.logErrors || !cache.errors.length) {
					cache.errors.push(err);
				}
				_tick(err, path, stats, _next_empty);
			} else if (!stats.isDirectory() || stats.isSymbolicLink()) {
				_tick(err, path, stats, _next_empty);
				cache.files++;
			} else {
				err	= undefined;
				er	= undefined;
				cache.dirs++;
				_tick(err, path, stats, function () {
					var files;
					try {
						files = fs.readdirSync(path);
					} catch (er) {
						err	= er;
					};
					if(err) {
						if (opts.logErrors || !cache.errors.length) {
							cache.errors.push(err);
							_next();
						}
					} else {
						if (Array.isArray(files)) {
							files.forEach(function (file) {
								_next(path + ( path[path.length -1] === separator ? "" : separator ) + file);
							});
						}
					}
				});
			}
		}
	};
	_next(path);
	onend_callback((opts.logErrors ? cache.errors : cache.errors[0]), cache);
};


walk.walk	= walk;
walk.sync	= walkSync;

module.exports = walk;