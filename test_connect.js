const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

var mongoose = require('mongoose');

// Connection URL
const url = 'mongodb://localhost:27017/local_library';

// Database Name
const dbName = 'local_library';

// // Create a new MongoClient
// const client = new MongoClient(url);

// // Use connect method to connect to the Server
// client.connect(function(err) {
//   assert.equal(null, err);
//   console.log("Connected successfully to server");

//   const db = client.db(dbName);

//   client.close();
// }, {useNewUrlParser: true});

mongoose.connect(url, { useNewUrlParser: true });
mongoose.Promise = global.Promise;
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));