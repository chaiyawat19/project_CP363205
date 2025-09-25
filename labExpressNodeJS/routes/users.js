const express = require('express');
const router = express.Router();
const { isUser } = require('../middleware/auth');

router.get('/', isUser, (req, res) => {
  res.render('indexUser', { title: 'หน้าหลัก User', name: req.session.userName });
});

module.exports = router;