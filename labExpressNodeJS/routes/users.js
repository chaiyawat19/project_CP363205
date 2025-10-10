const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const { isUser } = require('../middleware/auth');
const Equipment = require('../models/listEquipment');
const User = require('../models/User');
const Category = require('../models/Category');
const Borrow = require('../models/Borrow');
const RepairRequest = require('../models/Repair_requests'); 


// =================== MIDDLEWARE ===================
// ดึงข้อมูล user จาก session ก่อน render
router.use(isUser, async (req, res, next) => {
  try {
    if (req.session.userId) {
      const user = await User.findById(req.session.userId);
      res.locals.user = user;
    } else {
      res.locals.user = null;
    }
  } catch (err) {
    console.error('Error loading user middleware:', err);
    res.locals.user = null;
  }
  next();
});

// ตรวจสอบ session userId
const ensureUserId = (req, res, next) => {
  if (!req.session.userId) return res.redirect('/');
  next();
};

// =================== HELPER FUNCTIONS ===================
const getStatusBadge = (status) => {
  switch (status) {
    case 'waiting': return '<span class="badge bg-warning text-dark">รอยืนยัน</span>';
    case 'borrowed': return '<span class="badge bg-primary">กำลังยืม</span>';
    case 'returned': return '<span class="badge bg-success">คืนแล้ว</span>';
    case 'rejected': return '<span class="badge bg-danger">ถูกปฏิเสธ</span>';
    case 'waitingForReturn': return '<span class="badge bg-info">รอการยืนยันการคืน</span>';
    default: return `<span class="badge bg-secondary">${status}</span>`;
  }
};

// =================== ROUTES ===================

// ---------- DASHBOARD ----------
router.get('/', isUser, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    // ดึงรายการยืม
    const borrows = await Borrow.find({ user_id: req.session.userId })
      .populate('equipment_id')
      .sort({ created_at: -1 });

    // ดึงรายการแจ้งซ่อมจาก RepairRequest
    const repairRequests = await RepairRequest.find({ user_id: req.session.userId, deleted_at: null })
      .populate('equipment_id') // ถ้าต้องการชื่ออุปกรณ์
      .sort({ created_at: -1 });

    res.render('indexUser', {
      title: 'หน้าหลัก User',
      name: `${user.fname} ${user.lname}`,
      layout: 'layouts/navuser',
      activePage: 'dashboard',
      user,
      borrows: borrows || [],
      Reqair_requests: repairRequests || [] // <-- ตัวนี้ต้องใช้ใน EJS
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('indexUser', {
      title: 'เกิดข้อผิดพลาด',
      name: '',
      layout: 'layouts/navuser',
      activePage: 'dashboard',
      user: null,
      borrows: [],
      Reqair_requests: []
    });
  }
});

// ---------- REPAIR FORM ----------
router.get('/repair', isUser, async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/login');

    const borrows = await Borrow.find({ user_id: userId, status: 'borrowed' })
      .populate('equipment_id');
    const equipments = borrows.map(b => b.equipment_id);

    res.render('repairFormUser', {
      title: 'แจ้งซ่อมอุปกรณ์',
      userId,
      equipments,
      errorMessage: null
    });
  } catch (err) {
    console.error('❌ Error loading repair form:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูลอุปกรณ์');
  }
});

// POST แจ้งซ่อม → บันทึกไป RepairRequest
router.post('/repair', isUser, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { equipmentId, type } = req.body;

    if (!equipmentId) {
      const borrows = await Borrow.find({ user_id: userId, status: 'borrowed' }).populate('equipment_id');
      const equipments = borrows.map(b => b.equipment_id);

      return res.render('repairFormUser', {
        title: 'แจ้งซ่อมอุปกรณ์',
        errorMessage: 'กรุณาเลือกอุปกรณ์',
        equipments
      });
    }

    const newRequest = new RepairRequest({
      user_id: userId,
      equipment_id: equipmentId,
      issue_description: type || '',
      status: 'รอซ่อม'
    });

    await newRequest.save();

    res.redirect('/users');
  } catch (error) {
    console.error(error);
    const borrows = await Borrow.find({ user_id: req.session.userId, status: 'borrowed' }).populate('equipment_id');
    const equipments = borrows.map(b => b.equipment_id);

    res.render('repairFormUser', {
      title: 'แจ้งซ่อมอุปกรณ์',
      errorMessage: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
      equipments
    });
  }
});

// ---------- EQUIPMENT ----------
router.get('/equipment/:id', async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id).select('location name');
    if (!equipment) return res.status(404).json({ location: '' });
    res.json({ location: equipment.location || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ location: '' });
  }
});

router.get('/equipments/:id', async (req, res) => {
  try {
    const item = await Equipment.findById(req.params.id).populate('category_id');
    if (!item) return res.status(404).send('ไม่พบอุปกรณ์');

    res.render('equipmentDetail', {
      title: item.name,
      item,
      layout: 'layouts/navuser',
      activePage: 'listitemuser'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

router.get('/listitemuser', async (req, res) => {
  try {
    const equipments = await Equipment.find({ deleted_at: null }).populate('category_id');
    res.render('listitemUser', {
      title: 'อุปกรณ์ทั้งหมดในบริษัท',
      name: req.session.userName,
      layout: 'layouts/navuser',
      activePage: 'listitemuser',
      equipments
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// ---------- BORROW ----------
router.post('/borrow/:id', isUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { return_date, note } = req.body;
    const userId = req.session.userId;

    if (!userId) return res.status(401).send('กรุณาเข้าสู่ระบบก่อน');

    const equipment = await Equipment.findById(id);
    if (!equipment) return res.status(404).send('ไม่พบอุปกรณ์');

    const borrow = new Borrow({
      user_id: userId,
      equipment_id: id,
      return_date: new Date(return_date),
      note
    });

    await borrow.save();
    equipment.status = 'unavailable';
    await equipment.save();

    res.redirect('/users/listitemuser');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

router.get('/borrowreturn', isUser, async (req, res) => {
  const userId = req.session.userId;
  const search = req.query.search || '';
  try {
    let borrows = await Borrow.find({ user_id: userId }).populate('equipment_id').sort({ created_at: -1 });
    if (search) {
      borrows = borrows.filter(b => b.equipment_id?.name?.toLowerCase().includes(search.toLowerCase()));
    }
    res.render('userBorrowHistory', {
      title: 'ประวัติการยืม',
      borrows,
      getStatusBadge,
      layout: 'layouts/navuser',
      activePage: 'borrowreturn',
      search
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
});

router.post('/return/:borrowId', isUser, async (req, res) => {
  try {
    const { borrowId } = req.params;
    const userId = req.session.userId;

    const borrowRecord = await Borrow.findOne({ _id: borrowId, user_id: userId, status: 'borrowed' });
    if (!borrowRecord) return res.status(404).redirect('/users/borrowreturn');

    borrowRecord.status = 'waitingForReturn';
    borrowRecord.actual_return_date = new Date();
    await borrowRecord.save();

    res.redirect('/users/borrowreturn');
  } catch (err) {
    console.error("Error submitting return request:", err);
    res.status(500).redirect('/users/borrowreturn');
  }
});

// ---------- SETTINGS ----------
router.get('/setting', isUser, ensureUserId, async (req, res) => {
  const userId = req.session.userId;
  try {
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).send("User data not found in database.");

    res.render('settings', {
      title: 'การตั้งค่าผู้ใช้',
      name: req.session.userName,
      user,
      layout: 'layouts/navuser',
      activePage: 'setting',
      req
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.post('/setting', isUser, ensureUserId, async (req, res) => {
  const userId = req.session.userId;
  const { fname, lname, email, department } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    user.fname = fname;
    user.lname = lname;
    user.email = email;
    user.department = department;
    await user.save();

    req.session.userName = `${fname} ${lname}`;
    res.redirect('/users/setting?msg=updated');
  } catch (err) {
    console.error(err);
    res.redirect('/users/setting?err=updatefail');
  }
});

// ---------- CHANGE PASSWORD ----------
router.post('/setting/password', isUser, ensureUserId, async (req, res) => {
  const userId = req.session.userId;
  const { oldPassword, newPassword } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.redirect('/users/setting?err=wrongpass');

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    req.session.destroy(err => {
      if (err) {
        console.error(err);
        return res.redirect('/users/setting?err=pass_fail');
      }
      res.clearCookie('connect.sid');
      res.redirect('/?msg=password_changed_login');
    });
  } catch (err) {
    console.error(err);
    res.redirect('/users/setting?err=pass_fail');
  }
});

// ---------- LOGOUT ----------
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// ---------- NOTIFICATIONS ----------
router.get("/notifications", isUser, (req, res) => {
  res.render("notificationsUser", {
    title: "การแจ้งเตือน",
    name: req.session.userName,
    layout: 'layouts/navuser',
    activePage: 'notifications'
  });
});

module.exports = router;
