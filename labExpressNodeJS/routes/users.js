const express = require('express');
const router = express.Router();
const { isUser } = require('../middleware/auth');
const Equipment = require('../models/listEquipment');
const Category = require('../models/Category');
const User = require('../models/User');
const Borrow = require('../models/Borrow');


router.get('/', isUser, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const equipments = await Equipment.find({ deleted_at: null }).populate('category_id');
        console.log('User found:', user); // เพิ่มบรรทัดนี้
        const borrows = await Borrow.find({ user_id: req.session.userId }).populate('equipment_id').populate('user_id').sort({ created_at: -1 });


        res.render('indexUser', { 
            title: 'หน้าหลัก User', 
            name: `${user.fname} ${user.lname}`, 
            layout: 'layouts/navuser', 
            activePage: 'dashboard', 
            user: user,
            equipments: equipments,
            borrows: borrows
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).render('indexUser', { 
            title: 'เกิดข้อผิดพลาดของระบบ', 
            name: '', 
            layout: 'layouts/navuser', 
            activePage: 'dashboard', 
            user: null,
            equipments: [] ,
            borrows: []
        });
    }
});

router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid'); 
    res.redirect('/'); // 
  });
});

router.get('/listitemuser', async (req,res) => {
  try {
    const equipments = await Equipment.find({ deleted_at: null }).populate('category_id');
    res.render('listitemUser',{ 
      title : 'อุปกรณ์ทั้งหมดในบริษัท', 
      name: req.session.userName,
      layout:'layouts/navuser',
      activePage: 'listitemuser',
      equipments: equipments
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

module.exports = router;




module.exports = router;