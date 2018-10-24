var mrequire	= require("module-require");

var nodejsFsUtils	= {
	ensureFile	: false,
	ensureFileSync	: false,
	outputFile		: false,
	outputFileSync	: false,
	outputJson		: false,
	outputJsonSync	: false,
	readJson		: false,
	readJsonSync	: false,
	writeJson		: false,
	writeJsonSync	: false,
};
var getLibrary	= function (list) {
	var lib	= {};
	if (list.indexOf('copy') !== -1) {
		mrequire("copy", __dirname + "/fs/copy/index.js");
		lib.copy	= mrequire("copy");
		lib.copySync	= mrequire("copy").sync;
	}
	if (list.indexOf('rmdirs') !== -1) {
		mrequire("rmdirs", __dirname + "/fs/rmdirs/index.js");
		lib.rmdirs	= mrequire("rmdirs");
		lib.rmdirsSync	= mrequire("rmdirs").sync;
		lib.remove	= mrequire("rmdirs");
		lib.removeSync	= mrequire("rmdirs").sync;
	}
	if (list.indexOf('fsize') !== -1) {
		mrequire("fsize", __dirname + "/fs/fsize/index.js");
		lib.fsize	= mrequire("fsize");
		lib.fsizeSync	= mrequire("fsize").sync;
	}
	if (list.indexOf('walk') !== -1) {
		mrequire("walk", __dirname + "/fs/walk/index.js");
		lib.walk	= mrequire("walk");
		lib.walkSync	= mrequire("walk").sync;
	}
	if (list.indexOf('mkdirs') !== -1) {
		mrequire("mkdirs", __dirname + "/fs/mkdirs/index.js");
		lib.mkdirs	= mrequire("mkdirs");
		lib.mkdirsSync	= mrequire("mkdirs").sync;
		lib.ensureDir	= mrequire("mkdirs");
		lib.ensureDirSync	= mrequire("mkdirs").sync;
	}
	if (list.indexOf('move') !== -1) {
		mrequire("move", __dirname + "/fs/move/index.js");
		lib.move	= mrequire("move");
		lib.moveSync	= mrequire("move").sync;
	}
	if (list.indexOf('emptydir') !== -1) {
		mrequire("emptydir", __dirname + "/fs/emptydir/index.js");
		lib.emptyDir	= mrequire("emptydir");
		lib.emptyDirSync	= mrequire("emptydir").sync;
		lib.isEmpty	= mrequire("emptydir").isEmpty;
		lib.isEmptySync	= mrequire("emptydir").isEmpty.sync;
	}
	if (list.indexOf('output') !== -1) {
		mrequire("output", __dirname + "/fs/output/index.js");
		lib.createFile	= mrequire("output").createFile;
		lib.createFileSync	= mrequire("output").createFile.sync;
		lib.ensureFile	= mrequire("output").createFile;
		lib.ensureFileSync	= mrequire("output").createFile.sync;
	}
	return lib;
};

getLibrary.allList	= ['copy', 'move', 'rmdirs', 'fsize', 'walk', 'mkdirs', 'emptydir', 'output'];
module.exports	= getLibrary;