const express = require('express');
const router = express.Router();
const { isUser } = require('../middleware/auth');

router.get('/', isUser, (req, res) => {
  res.render('indexUser', { 
    title: 'หน้าหลัก User', 
    name: req.session.userName,
    layout: 'layouts/navuser',
    activePage: 'dashboard' // อันนี้เอาไว้ทำ active จะได้รู้ว่าเราเปิดหน้าไหนอยู่
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

router.get('/listitemuser',(req,res) => {
  res.render('listitemUser',{ 
    title : 'อุปกรณ์ทั้งหมดในบริษัท', 
    name: req.session.userName,
    layout:'layouts/navuser',
    activePage: 'listitemuser'
  })
})

module.exports = router;