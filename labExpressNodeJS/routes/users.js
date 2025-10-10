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
const RepairRequest = require('../models/Reqair_requests');
const Department = require('../models/Department');

// =================== HELPER ===================
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

const ensureUserId = (req, res, next) => {
  if (!req.session.userId) return res.redirect('/');
  next();
};

// =================== MIDDLEWARE ===================
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

// =================== ROUTES ===================

// ---------- DASHBOARD ----------
router.get('/', isUser, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const borrows = await Borrow.find({ user_id: req.session.userId })
      .populate('equipment_id')
      .sort({ created_at: -1 });

    const repairRequests = await RepairRequest.find({ user_id: req.session.userId, deleted_at: null })
      .populate('equipment_id')
      .sort({ created_at: -1 });

    res.render('indexUser', {
      title: 'หน้าหลัก User',
      layout: 'layouts/navuser',
      activePage: 'dashboard',
      user,
      borrows: borrows || [],
      repairs: repairRequests || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('indexUser', {
      title: 'เกิดข้อผิดพลาด',
      layout: 'layouts/navuser',
      activePage: 'dashboard',
      user: null,
      borrows: [],
      repairs: []
    });
  }
});

// ---------- REPAIR FORM ----------
// GET /repair
router.get('/repair', isUser, async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/login');

    // ดึงเฉพาะอุปกรณ์ที่ผู้ใช้กำลังยืมอยู่
    const borrows = await Borrow.find({ user_id: userId, status: 'borrowed' })
      .populate('equipment_id');
    const equipments = borrows.map(b => b.equipment_id);

    res.render('repairFormUser', {
      title: 'แจ้งซ่อมอุปกรณ์',
      user: res.locals.user,        // ส่ง user ให้ navbar
      equipments,                   // อุปกรณ์ที่ยืมอยู่
      errorMessage: null,
      baseUrl: req.baseUrl,
      activePage: 'repairForm'      // ส่ง activePage ให้ navbar
    });
  } catch (err) {
    console.error('❌ Error loading repair form:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูลอุปกรณ์');
  }
});

// POST /repair
router.post('/repair', isUser, async (req, res) => { 
  try {
    const { equipmentId, location, type } = req.body;
    const userId = req.session.userId;

    if (!userId) return res.redirect('/login');

    if (!equipmentId) {
      // ดึงอุปกรณ์อีกครั้งเมื่อเกิด error
      const borrows = await Borrow.find({ user_id: userId, status: 'borrowed' })
        .populate('equipment_id');

      return res.render('repairFormUser', {
        title: 'แจ้งซ่อม',
        user: res.locals.user,                          // ส่ง user ให้ navbar
        errorMessage: 'กรุณาเลือกอุปกรณ์',
        equipments: borrows.map(b => b.equipment_id),
        baseUrl: req.baseUrl,
        activePage: 'repairForm'                        // ส่ง activePage ให้ navbar
      });
    }

    const newRepair = new RepairRequest({
      user_id: userId,
      equipment_id: equipmentId,
      location: location,
      issue_description: type || ''
    });

    await newRepair.save();
    res.redirect(`${req.baseUrl}`); // กลับไปหน้า /users
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});


// ---------- EQUIPMENT ----------
router.get('/equipment/:id', isUser, async (req, res) => {
  try {
    const userId = req.session.userId;
    const borrow = await Borrow.findOne({ user_id: userId, equipment_id: req.params.id, status: 'borrowed' })
      .populate('equipment_id');

    if (!borrow || !borrow.equipment_id) {
      return res.status(404).json({ error: 'ไม่พบอุปกรณ์หรือคุณไม่ได้ยืม' });
    }

    const equipment = borrow.equipment_id;
    res.json({
      _id: equipment._id,
      name: equipment.name,
      location: equipment.location || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์' });
  }
});

// ---------- BORROW ----------
router.post('/borrow/:id', isUser, async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).send('กรุณาเข้าสู่ระบบก่อน');

    const { id } = req.params;
    const { return_date, note } = req.body;

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

    res.redirect(`${req.baseUrl}/listitemuser`);
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

// ---------- RETURN ----------
router.post('/return/:borrowId', isUser, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { borrowId } = req.params;

    const borrowRecord = await Borrow.findOne({ _id: borrowId, user_id: userId, status: 'borrowed' });
    if (!borrowRecord) return res.status(404).redirect(`${req.baseUrl}/borrowreturn`);

    borrowRecord.status = 'waitingForReturn';
    borrowRecord.actual_return_date = new Date();
    await borrowRecord.save();

    res.redirect(`${req.baseUrl}/borrowreturn`);
  } catch (err) {
    console.error("Error submitting return request:", err);
    res.status(500).redirect(`${req.baseUrl}/borrowreturn`);
  }
});

// ---------- SETTINGS ----------
router.get('/setting', ensureUserId, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password').populate('department');
    const departments = await Department.find({ deleted_at: null }).select('name');
    res.render('settings', {
      title: 'การตั้งค่าผู้ใช้',
      user,
      departments,
      layout: 'layouts/navuser',
      activePage: 'setting'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.post('/setting', ensureUserId, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).send("User not found");

    const { fname, lname, email, department } = req.body;
    user.fname = fname;
    user.lname = lname;
    user.email = email;
    user.department = department;
    await user.save();

    res.redirect(`${req.baseUrl}/setting?msg=updated`);
  } catch (err) {
    console.error(err);
    res.redirect(`${req.baseUrl}/setting?err=updatefail`);
  }
});

// ---------- CHANGE PASSWORD ----------
router.post('/setting/password', ensureUserId, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).send("User not found");

    const { oldPassword, newPassword } = req.body;
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.redirect(`${req.baseUrl}/setting?err=wrongpass`);

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    req.session.destroy(err => {
      if (err) {
        console.error(err);
        return res.redirect(`${req.baseUrl}/setting?err=pass_fail`);
      }
      res.clearCookie('connect.sid');
      res.redirect('/?msg=password_changed_login');
    });
  } catch (err) {
    console.error(err);
    res.redirect(`${req.baseUrl}/setting?err=pass_fail`);
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
    layout: 'layouts/navuser',
    activePage: 'notifications',
    user: res.locals.user
  });
});

module.exports = router;
