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
            getStatusBadge: getStatusBadge,
            layout: 'layouts/navuser',
            activePage: 'borrowreturn'
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
    }
});

const getStatusBadge = (status) => {
    switch (status) {
        case 'waiting':
            return '<span class="badge bg-warning text-dark">รอยืนยัน</span>';
        case 'borrowed':
            return '<span class="badge bg-primary">กำลังยืม</span>';
        case 'returned':
            return '<span class="badge bg-success">คืนแล้ว</span>';
        case 'rejected':
            return '<span class="badge bg-danger">ถูกปฏิเสธ</span>';
        case 'waitingForReturn': // สถานะใหม่ที่คุณเพิ่ม
            return '<span class="badge bg-info">รอการยืนยันการคืน</span>';
        default:
            return `<span class="badge bg-secondary">${status}</span>`;
    }
};

router.post('/return/:borrowId', isUser, async (req, res) => {
    try {
        const { borrowId } = req.params;
        const userId = req.session.userId;

        const borrowRecord = await Borrow.findOne({ 
            _id: borrowId, 
            user_id: userId,
            status: 'borrowed'
        });

        if (!borrowRecord) {
            return res.status(404).redirect('/users/borrowreturn'); 
        }

        borrowRecord.status = 'waitingForReturn'; 
        
        borrowRecord.actual_return_date = new Date(); 

        await borrowRecord.save();

        res.redirect('/users/borrowreturn'); 

    } catch (err) {
        console.error("Error submitting return request:", err);
        res.status(500).redirect('/users/borrowreturn');
    }
});

module.exports = router;