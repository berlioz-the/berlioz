var fsize	= require(__dirname + "/index.js");
var test	= function (path, opts) {
	fsize(path, opts, function (err, size) {
		if (err) {
			console.log("\033[7m");
			console.error(err, size, " bytes");
			console.log("\033[0m");
		} else {
			console.log(path, " ::: ", size, " bytes");
		}
	});
};

var testSync	= function (path, opts) {
	var size;
	var err;
	try {
		size = fsize.sync(path, opts);
	} catch (err) {
		console.log("\033[7;35m");
		console.error(err);
		console.log("\033[0m");
	};
	if (err) {
		console.log("\033[7;33m");
		console.error(err, size, " bytes");
		console.log("\033[0m");
	} else {
		console.log("\033[33m",path, " ::: ", size, " bytes\033[0m");
	}
};

test(__dirname);
test(__dirname + "/index.js");
test(__dirname + "/../../");
test(__dirname, {
	logErrors	: true,
	skipErrors	: true,
	countFolders: true,
	symbolicLinks	: true,
	countSymbolicLinks	: true
});
test(__dirname + "/index.js", {
	logErrors	: true,
	skipErrors	: true,
	countFolders: true,
	symbolicLinks	: true,
	countSymbolicLinks	: true
});
test(__dirname + "/../../", {
	logErrors	: true,
	skipErrors	: true,
	countFolders: true,
	symbolicLinks	: true,
	countSymbolicLinks	: true
});


testSync(__dirname);
testSync(__dirname + "/index.js");
testSync(__dirname + "/../../");
testSync(__dirname, {
	logErrors	: true,
	skipErrors	: true,
	countFolders: true,
	symbolicLinks	: true,
	countSymbolicLinks	: true
});
testSync(__dirname + "/index.js", {
	logErrors	: true,
	skipErrors	: true,
	countFolders: true,
	symbolicLinks	: true,
	countSymbolicLinks	: true
});
testSync(__dirname + "/../../", {
	logErrors	: true,
	skipErrors	: true,
	countFolders: true,
	symbolicLinks	: true,
	countSymbolicLinks	: true
});
testSync('/');

