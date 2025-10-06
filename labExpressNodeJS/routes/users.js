const express = require('express');
const router = express.Router();
const { isUser } = require('../middleware/auth');
const Equipment = require('../models/listEquipment');
const Category = require('../models/Category');
const Borrow = require('../models/Borrow');


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


router.get('/equipments/:id', async (req, res) => {

  const item = await Equipment.findById(req.params.id);
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

module.exports = router;