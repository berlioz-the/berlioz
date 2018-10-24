var rmdirs = require(__dirname + "/index.js");

rmdirs.sync("test-sync.txt");
rmdirs.sync("test-sync");

rmdirs("test.txt", function (err) {
	if (err) {
		console.error(err);
	}
});
rmdirs("test", function (err) {
	if (err) {
		console.error(err);
	}
});