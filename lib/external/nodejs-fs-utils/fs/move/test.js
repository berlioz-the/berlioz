var move	= require(__dirname + "/index.js");


move.sync(__dirname + "/tmp-test", "/media/web/tmp-test", function (errors, cache) {
	console.log(arguments);
});

// move(__dirname + "/tmp-test2", "/media/web/tmp-test", function (errors, cache) {
// 	console.log(arguments);
// });
