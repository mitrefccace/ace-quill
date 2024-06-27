/*
                                 NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number 75FCMC18D0047/75FCMC23D0004, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
McLean, VA 22102-7539, (703) 983-6000.

                        ©2024 The MITRE Corporation.
*/

const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const config = require('./configs/config.js');

const mysqlOptions = {
  host: config.mysql.host,
  user:  config.mysql.user,
  password:  config.mysql.password,
  database:  config.mysql.database,
  connectionLimit : 50,
  dateStrings: true
};

const mysqlConnection = mysql.createPool(mysqlOptions);

const sessionStore = new MySQLStore(mysqlOptions);

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  name: config.session.name,
  resave: true,
  saveUninitialized: true,
  secret: config.session.secret,
  secure: true,
  store: sessionStore,
}));

// Make the db and configs accessible to routes

app.use((req, res, next) => {
  req.dbconn = mysqlConnection;

  res.locals.version = process.env.npm_package_version;
  res.locals.fullname = (req.session.firstname) ? `${req.session.firstname} ${req.session.lastname}` : 'Unknown';
  res.locals.role = (req.session.role) ? req.session.role : 'Unknown';
  res.locals.group = (req.session.group_name) ? req.session.group_name : 'Unknown';

  next();
});

const terminal = require('./routes/terminal');
const admin = require('./routes/admin');

app.use('/', terminal);
app.use('/admin', admin);
// catch 404 and forward to error handler

app.use((_req, _res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use((err, req, res) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('pages/error');
});

module.exports = app;
