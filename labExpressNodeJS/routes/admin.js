var express = require("express");
var router = express.Router();
const { isAdmin } = require ('../middleware/auth');

router.get('/', isAdmin, (req, res) => {
  res.render('indexAdmin', { 
    title: 'หน้าหลัก Admin', 
    name: req.session.userName , 
    layout: 'layouts/navadmin',
    activePage: 'dashboard'
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid'); // ลบ cookie ออกด้วย
    res.redirect('/'); // กลับไปหน้า login หรือหน้าแรก
  });
});

module.exports = router;
