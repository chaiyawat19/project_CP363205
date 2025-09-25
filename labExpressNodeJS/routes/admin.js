var express = require("express");
var router = express.Router();
const { isAdmin } = require ('../middleware/auth');

router.get('/', isAdmin, (req, res) => {
  res.render('indexAdmin', { title: 'หน้าหลัก Admin', name: req.session.userName });
});

module.exports = router;
