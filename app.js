var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
//var usersRouter = require('./routes/users');
var catalogRouter = require('./routes/catalog');

var compression = require('compression');
var helmet = require('helmet');

var app = express();

//app.use(logger(':method :url :status :res[content-length] - dk :response-time ms'));
//app.use(logger('tiny'));

//Set up mongoose connection
var mongoose = require('mongoose');
// var mongoDB = "mongodb+srv://dbUser:XyxDbtJ4JiFY4DLv@cluster0-3sbe6.mongodb.net/local_library?retryWrites=true&w=majority";
// var mongoDB = "mongodb+srv://dbUser:dbUser1501@cluster0-3sbe6.mongodb.net/local_library?retryWrites=true&w=majority";
var mongoDB = "mongodb+srv://dbUser:dbUser1501@cluster0-3sbe6.mongodb.net/local_library?retryWrites=true&w=majority";
const url = 'mongodb://localhost:27017/local_library';

//mongoose.connect(mongoDB, { useNewUrlParser: true });
mongoose.connect(url, { useNewUrlParser: true, useFindAndModify: false });
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

//compress all routes
app.use(compression());
app.use(helmet());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
//app.use('/users', usersRouter);
app.use('/catalog', catalogRouter); //add catalog routes to middleware chain

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
