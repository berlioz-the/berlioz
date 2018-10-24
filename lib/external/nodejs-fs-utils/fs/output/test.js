var output	= require(__dirname + "/index.js");

console.log(output.createFile.sync(__dirname + '/a/b/s/d/s/f/sd/sd'));
output.createFile(__dirname + '/a/b/s/d/s/f/sd/sd', function () {
	console.log(arguments);
});
