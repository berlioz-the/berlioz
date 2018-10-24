var copy	= require(__dirname + "/index.js");


copy.sync(__dirname + "/tmp-test", "./tmp-test2", function (errors, cache) {
	console.log(arguments);
}, {
	linkFiles	: "relative"
});



// var walk	= require(__dirname + "/../../index.js").walk;
// var files	= [];
// walk(__dirname + "/tmp-test", {}, function (err, path, stats, _next, cache) {
// 	if (err) {
// 		console.log("\033[7m");
// 		console.log("[ ??? ]\tbytes\t:: ", path);
// 		console.log("\033[0m");
// 	} else {
// 		if (files.indexOf(path) !== -1) {
// 			console.log("\033[7;33m");
// 			console.error(err, cache, "ERROR");
// 			console.log("\033[0m");
// 		}
// 		files.push(path);
// 	}
// 	_next();
// }, function (err, cache) {
// 	console.log("\033[7;31m");
// 	console.error(err, cache, "ERROR");
// 	console.log("\033[0m");
// });
