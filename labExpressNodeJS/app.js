require('dotenv').config(); // โหลดค่า environment variables
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const expressLayouts = require('express-ejs-layouts');
const createError = require('http-errors');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const axios = require('axios');
// import routers
const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
const userRouter = require('./routes/users');

const app = express();
const PORT = 3001;

// ====== ตั้งค่า view engine ======
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/index'); // layout หลัก
app.set('view engine', 'ejs');

// ====== middleware ======
app.use(logger('dev')); // log request
app.use(express.json()); // รองรับ JSON request
app.use(express.urlencoded({ extended: true })); // รองรับ form data
app.use(cookieParser()); // parse cookies
app.use(express.static(path.join(__dirname, 'public'))); // static folder public
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // static folder uploads
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css')); // bootstrap css
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js')); // bootstrap js

// ====== ตั้งค่า session ======
app.use(session({
  secret: 'project_assetflow_secret', 
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 ชั่วโมง
}));

// ====== เชื่อม MongoDB ======
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// ====== routes ======
app.use('/', indexRouter);
app.use('/admin', adminRouter);
app.use('/users', userRouter);
app.use('/listitemuser', userRouter); // route เพิ่มเติมสำหรับ list item ของ user
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // ซ้ำได้ถ้าต้องการ

// ====== handle 404 ======
app.use(function(req, res, next) {
  next(createError(404));
});

// ====== handle errors ======
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// ====== start server ======
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// ====== ตั้งค่า global axios ======
global.axios = axios;

module.exports = app;
