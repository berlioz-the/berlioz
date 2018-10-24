// var walk	= require(__dirname + "/index.js");
var walk	= require(__dirname + "/../../index.js").walk;
var test	= function (path, opts, cb) {
	walk(path, opts, function (err, path, stats, _next, cache) {
		// if (err) {
		// 	console.log("\033[7m");
		// 	console.log("[ ??? ]\tbytes\t:: ", path);
		// 	console.log("\033[0m");
		// } else {
		// 	console.log(
		// 		((opts.stackPushEnd && cache.count < 10) ? "\033[7mTIMEOUT 1000ms\033[27m " : "") +
		// 		"async \t", stats.size, "\t :: ", path
		// 	);
		// }
		if (opts.stackPushEnd && cache.count < 10) {
			setTimeout(function () {
				_next();
			}, 1000);
		} else {
			_next();
		}
	}, function (err, cache) {
		console.log(path);
		console.log("\033[7;35m");
		console.error(err, cache, "ERROR");
		console.log("\033[0m");

		if (cb) {
			cb();
		}
	});
};

var testSync	= function (path, opts) {
	walk.sync(path, opts, function (err, path, stats, _next, cache) {
		cache.count = ((cache.count || 0) + 1);
		// if (err) {
		// 	console.log("\033[7m");
		// 	console.log("[ ??? ]\tbytes\t:: ", path);
		// 	console.log("\033[0m");
		// } else {
		// 	console.log("sync \t", stats.size, "\t :: ", path);
		// }
		_next();
	}, function (err, cache) {
		console.log(path);
		console.log("\033[7;35m");
		console.error(err, cache, "ERROR");
		console.log("\033[0m");
	});
};

var times	= [
	new Date()
]
test('/', {
	logErrors	: true,
	skipErrors	: true
	}, function () {
		times.push(new Date());
		test('/', {
			logErrors	: true,
			skipErrors	: true,
			stackPushEnd: true
		}, function () {
			times.push(new Date());
			testSync('/', {
				logErrors	: true,
				skipErrors	: true
			});
			times.push(new Date());
		
			console.log("\033[32;7mSync:\t" + ( ( times[3] - times[2] ) / 1000 )
				+ "\nAsync:\t" + ( ( times[1] - times[0] ) / 1000 )
				+ "\nAsync Push to End:\t" + ( ( times[2] - times[1] ) / 1000 )
				+ "\nSync/Async:\t" + ( ( times[3] - times[2] ) / ( times[1] - times[0] ) )
			);
		});
});
// test(__dirname);
// test(__dirname + "/index.js");
// test(__dirname + "/../../");
// test(__dirname, {
// 	logErrors	: true,
// 	skipErrors	: true,
// 	symbolicLinks	: true,
// });
// test(__dirname + "/index.js", {
// 	logErrors	: true,
// 	skipErrors	: true,
// 	symbolicLinks	: true,
// });
// test(__dirname + "/../../", {
// 	logErrors	: true,
// 	skipErrors	: true,
// 	symbolicLinks	: true,
// });


// testSync(__dirname);
// testSync(__dirname + "/index.js");
// testSync(__dirname + "/../../");
// testSync(__dirname, {
// 	logErrors	: true,
// 	skipErrors	: true,
// 	countFolders: true,
// 	symbolicLinks	: true,
// 	countSymbolicLinks	: true
// });
// testSync(__dirname + "/index.js", {
// 	logErrors	: true,
// 	skipErrors	: true,
// 	countFolders: true,
// 	symbolicLinks	: true,
// 	countSymbolicLinks	: true
// });
// testSync(__dirname + "/../../", {
// 	logErrors	: true,
// 	skipErrors	: true,
// 	countFolders: true,
// 	symbolicLinks	: true,
// 	countSymbolicLinks	: true
// });
// testSync('/');

