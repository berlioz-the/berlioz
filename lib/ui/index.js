var DataProvider = require('./mock-data-provider');
var dataProvider = new DataProvider();

var server = require("./server");

server(dataProvider);
