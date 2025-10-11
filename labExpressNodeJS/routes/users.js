const express = require('express');
const router = express.Router();

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');

// Models
const User = require('../models/User');
const Equipment = require('../models/listEquipment');
const Borrow = require('../models/Borrow');
const Category = require('../models/Category');
const Department = require('../models/Department');
const RepairRequest = require("../models/Reqair_requests"); // เก็บชื่อไฟล์ตามโปรเจกต์ของคุณ

// Middleware
const { isUser } = require('../middleware/auth');

// ---------------------------
// Multer (uploads) config
// ---------------------------
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// สร้างโฟลเดอร์ uploads หากยังไม่มี
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // ใช้ session.userId ถ้ามี ไม่มีก็ใช้ timestamp ดังนั้นควรแน่ใจว่า route ที่ใช้ upload จะผ่านการ authenticate
    const uid = (req.session && req.session.userId) ? req.session.userId : 'guest';
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uid}-profile-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// ---------------------------
// Global middleware for router
// - ตรวจสอบ isUser และดึงข้อมูลผู้ใช้จาก session
// ---------------------------
router.use(isUser, async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select('-password').populate('department');
      res.locals.user = user || null;
    } else {
      res.locals.user = null;
    }
  } catch (err) {
    console.error('Error loading user middleware:', err);
    res.locals.user = null;
  }
  next();
});

// ---------------------------
// Helper functions (badges, etc.)
// ---------------------------
const getRepairStatusBadge = (status) => {
  switch (status) {
    case 'pending':
      return '<span class="btn btn-warning btn-sm disable">รอดำเนินการ</span>';
    case 'in_progress':
      return '<span class="btn btn-info btn-sm disable">กำลังซ่อม</span>';
    case 'completed':
      return '<span class="btn btn-success btn-sm disable">ซ่อมเสร็จแล้ว</span>';
    case 'rejected':
      return '<span class="btn btn-danger btn-sm disable">ปฏิเสธ</span>';
    default:
      return `<span class="btn btn-secondary btn-sm disable">${status}</span>`;
  }
};

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
    case 'waitingForReturn':
      return '<span class="badge bg-info">รอการยืนยันการคืน</span>';
    default:
      return `<span class="badge bg-secondary">${status}</span>`;
  }
};

// ---------------------------
// Utility middleware
// ---------------------------
const ensureUserId = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/');
  }
  next();
};

// ---------------------------
// Routes: Dashboard / Home
// Route: GET /users/ - แสดงหน้าหลักของผู้ใช้ (Dashboard)
// ---------------------------
router.get('/', async (req, res) => {
  try {
    const user = res.locals.user;
    const equipments = await Equipment.find({ deleted_at: null }).populate('category_id');
    const borrows = await Borrow.find({ user_id: req.session.userId })
      .populate('equipment_id')
      .populate('user_id')
      .sort({ created_at: -1 });

    // ดึงข้อมูลการแจ้งซ่อมของ user
    const repairRequests = await RepairRequest.find({ user_id: req.session.userId })
      .populate('equipment_id')
      .sort({ created_at: -1 });

    // สร้าง map ของสถานะการแจ้งซ่อมของอุปกรณ์ (เฉพาะที่ยังไม่เสร็จหรือไม่ได้ถูกปฏิเสธ)
    const equipmentRepairStatus = {};
    repairRequests.forEach(repair => {
      if (repair.equipment_id && repair.status !== 'completed' && repair.status !== 'rejected') {
        equipmentRepairStatus[repair.equipment_id._id.toString()] = repair.status;
      }
    });

    res.render('indexUser', {
      title: 'หน้าหลัก User',
      name: user ? `${user.fname} ${user.lname}` : '',
      layout: 'layouts/navuser',
      activePage: 'dashboard',
      user,
      equipments,
      borrows,
      repairRequests,
      equipmentRepairStatus,
      getRepairStatusBadge
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).render('indexUser', {
      title: 'เกิดข้อผิดพลาดของระบบ',
      name: '',
      layout: 'layouts/navuser',
      activePage: 'dashboard',
      user: null,
      equipments: [],
      borrows: [],
      repairRequests: [],
      equipmentRepairStatus: {},
      getRepairStatusBadge
    });
  }
});

// ---------------------------
// Routes: Settings
// GET /users/setting - แสดงหน้าการตั้งค่าผู้ใช้
// ---------------------------
router.get('/setting', ensureUserId, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId).select('-password').populate('department');
    if (!user) return res.status(404).send("User data not found in database.");

    const departments = await Department.find({ deleted_at: null }).select('name');

    res.render('settings', {
      title: 'การตั้งค่าผู้ใช้',
      name: req.session.userName,
      user,
      departments,
      layout: 'layouts/navuser',
      activePage: 'setting',
      req
    });
  } catch (err) {
    console.error('GET /setting error:', err);
    res.status(500).send("Server Error");
  }
});

// POST /users/setting - อัปเดตข้อมูลผู้ใช้ (รวมการอัปโหลดรูปโปรไฟล์)
router.post('/setting', ensureUserId, upload.single('userProfileImage'), async (req, res) => {
  try {
    const userId = req.session.userId;
    const { fname, lname, email, department } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    user.fname = fname;
    user.lname = lname;
    user.email = email;
    user.department = department && department !== '' ? department : null;

    // ถ้ามีไฟล์อัปโหลดใหม่ ให้ลบไฟล์เก่าที่อยู่ใน /uploads/
    if (req.file) {
      const oldPath = user.userProfile; // คาดว่าเก็บเป็น '/uploads/xxx.jpg' หรือ null
      if (oldPath && oldPath.startsWith('/uploads/')) {
        const fullPath = path.join(__dirname, '..', oldPath.substring(1));
        fs.unlink(fullPath, (err) => {
          if (err) {
            console.error(`ERROR: ไม่สามารถลบไฟล์เก่า (${fullPath}) ได้:`, err);
          } else {
            console.log(`ลบไฟล์เก่าสำเร็จ: ${fullPath}`);
          }
        });
      }

      // บันทึก path ใหม่
      user.userProfile = '/uploads/' + req.file.filename;
      console.log(`User ID ${userId} อัปโหลดรูปใหม่: ${user.userProfile}`);
    }

    await user.save();

    req.session.userName = `${fname} ${lname}`;
    res.redirect('/users/setting?msg=updated');
  } catch (err) {
    console.error("Error in POST /users/setting:", err);
    res.redirect('/users/setting?err=updatefail');
  }
});

// POST /users/setting/password - เปลี่ยนรหัสผ่าน
router.post('/setting/password', ensureUserId, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.redirect('/users/setting?err=wrongpass');
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.redirect('/users/setting?msg=password_changed');
  } catch (err) {
    console.error("Error changing password:", err);
    return res.redirect('/users/setting?err=updatefail');
  }
});

// ---------------------------
// Routes: Auth
// GET /users/logout - ออกจากระบบ
// ---------------------------
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session on logout:', err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// ---------------------------
// Routes: Equipment / Items
// GET /users/listitemuser - แสดงรายการอุปกรณ์ทั้งหมด
// ---------------------------
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
    console.error('GET /listitemuser error:', err);
    res.status(500).send("Database error");
  }
});

// GET /users/equipments/:id - แสดงรายละเอียดอุปกรณ์
router.get('/equipments/:id', async (req, res) => {
  try {
    const item = await Equipment.findById(req.params.id).populate('category_id');
    if (!item) return res.status(404).send('ไม่พบอุปกรณ์');

    res.render('equipmentDetail', {
      title: item.name,
      item,
      layout: 'layouts/navuser',
      activePage: 'listitemuser',
    });
  } catch (err) {
    console.error('GET /equipments/:id error:', err);
    res.status(500).send('Server error');
  }
});

// ---------------------------
// Routes: Notifications
// GET /users/notifications - หน้าการแจ้งเตือนของผู้ใช้
// ---------------------------
router.get('/notifications', (req, res) => {
  res.render('notificationsUser', {
    title: 'การแจ้งเตือน',
    name: req.session.userName,
    layout: 'layouts/navuser',
    activePage: 'notifications'
  });
});

// ---------------------------
// Routes: Borrowing
// POST /users/borrow/:id - ยืมอุปกรณ์ (สร้าง record Borrow)
// ---------------------------
router.post('/borrow/:id', async (req, res) => {
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
      return_date: return_date ? new Date(return_date) : null,
      note: note || '',
      created_at: new Date()
    });

    await borrow.save();

    equipment.status = 'unavailable';
    await equipment.save();

    res.redirect('/users/listitemuser');
  } catch (err) {
    console.error('POST /borrow/:id error:', err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

// GET /users/borrowreturn - ประวัติการยืมและการค้นหา
router.get('/borrowreturn', async (req, res) => {
  try {
    const userId = req.session.userId;
    const search = (req.query.search || '').trim();

    let borrows = await Borrow.find({ user_id: userId })
      .populate('equipment_id')
      .sort({ created_at: -1 });

    if (search) {
      borrows = borrows.filter(b =>
        b.equipment_id?.name?.toLowerCase().includes(search.toLowerCase())
      );
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
    console.error('GET /borrowreturn error:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
});

// POST /users/return/:borrowId - ส่งคำขอคืนอุปกรณ์
router.post('/return/:borrowId', async (req, res) => {
  try {
    const { borrowId } = req.params;
    const userId = req.session.userId;

    const borrowRecord = await Borrow.findOne({
      _id: borrowId,
      user_id: userId,
      status: 'borrowed'
    });

    if (!borrowRecord) {
      return res.redirect('/users/borrowreturn');
    }

    borrowRecord.status = 'waitingForReturn';
    borrowRecord.actual_return_date = new Date();
    await borrowRecord.save();

    res.redirect('/users/borrowreturn');
  } catch (err) {
    console.error('POST /return/:borrowId error:', err);
    res.status(500).redirect('/users/borrowreturn');
  }
});

// ---------------------------
// Routes: Repair Requests
// POST /users/repair/:equipmentId - แจ้งซ่อมอุปกรณ์
// ---------------------------
router.post('/repair/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { issue_description } = req.body;
    const userId = req.session.userId;

    if (!issue_description || !equipmentId) {
      return res.status(400).send('กรุณากรอกรายละเอียดให้ครบถ้วน');
    }

    const newRepair = new RepairRequest({
      user_id: userId,
      equipment_id: equipmentId,
      issue_description,
      status: 'pending',
      created_at: new Date()
    });

    await newRepair.save();

    res.redirect('/users?msg=repair_submitted');
  } catch (err) {
    console.error('POST /repair/:equipmentId error:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูลแจ้งซ่อม');
  }
});

// ---------------------------
// Export router
// ---------------------------
module.exports = router;