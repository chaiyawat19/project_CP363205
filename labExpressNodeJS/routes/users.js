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
  })




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
    res.clearCookie('connect.sid'); 
    res.redirect('/'); // 
  });
});

router.get('/listitemuser', async (req, res) => {
  try {
    const equipments = await Equipment.find({ deleted_at: null }).populate('category_id');
    res.render('listitemUser', {
      title: 'อุปกรณ์ทั้งหมดในบริษัท',
      name: req.session.userName,
      layout: 'layouts/navuser',
      activePage: 'listitemuser',
      equipments: equipments
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

router.get('/historyBorrowed',async (req,res) =>{
   try {
        const user = await User.findById(req.session.userId);
        const equipments = await Equipment.find({ deleted_at: null }).populate('category_id');
        const borrows = await Borrow.find({ user_id: req.session.userId }).populate('equipment_id').populate('user_id').sort({ created_at: -1 });


        res.render('historyBorrowedUser', { 
            title: 'หน้าหลัก User', 
            name: `${user.fname} ${user.lname}`, 
            layout: 'layouts/navuser', 
            activePage: 'history', 
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
            activePage: 'history', 
            user: null,
            equipments: [] ,
            borrows: []
        });
    }
});

router.get('/equipments/:id', async (req, res) => {

  const item = await Equipment.findById(req.params.id).populate('category_id');

  if (!item) return res.status(404).send('ไม่พบอุปกรณ์');

  res.render('equipmentDetail', {
    title: item.name,
    item,
    layout: 'layouts/navuser',
    activePage: 'listitemuser',
  });
});


router.post('/borrow/:id', isUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { return_date, note } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).send('กรุณาเข้าสู่ระบบก่อน');
    }

    // ตรวจสอบว่าอุปกรณ์มีอยู่ไหม
    const equipment = await Equipment.findById(id);
    if (!equipment) {
      return res.status(404).send('ไม่พบอุปกรณ์');
    }

    // ✅ บันทึกข้อมูลการยืม
    const borrow = new Borrow({
      user_id: userId,
      equipment_id: id,
      return_date: new Date(return_date),
      note: note,
    });

    await borrow.save();

    equipment.status = 'unavailable';
    await equipment.save();

    res.redirect('/users/listitemuser'); // กลับไปหน้ารายการอุปกรณ์
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

router.get('/borrowreturn', isUser, async (req, res) => {
    
    const userId = req.session.userId; 
    
    try {
        const borrows = await Borrow.find({ user_id: userId })
            .populate('equipment_id') 
            .sort({ created_at: -1 });

        res.render('userBorrowHistory', {
            title: 'ประวัติการยืม',
            borrows: borrows,
            layout: 'layouts/navuser',
            activePage: 'borrowreturn'
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
    }
});

module.exports = router;