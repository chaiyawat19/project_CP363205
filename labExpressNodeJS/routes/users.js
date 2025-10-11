const express = require('express');
const router = express.Router();
const { isUser } = require('../middleware/auth');
const Equipment = require('../models/listEquipment');
const User = require('../models/User');
const Category = require('../models/Category');
const Borrow = require('../models/Borrow');
const Department = require('../models/Department');;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const RepairRequest = require("../models/Reqair_requests");


// ใน routes/users.js (ส่วนบนสุด หลังจากการ require Modules ต่างๆ)

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 📢 ใช้ path.join(__dirname, '..', 'uploads') เพื่อชี้ไปที่ [Root Project]/uploads
        const uploadPath = path.join(__dirname, '..', 'uploads');
        
        // ตรวจสอบและสร้างโฟลเดอร์ uploads (ถ้ายังไม่มี)
        if (!fs.existsSync(uploadPath)) {
            // fs.mkdirSync(uploadPath, { recursive: true }); // ถ้าไม่ต้องการเพิ่มโค้ดเยอะ ไม่ต้องใส่ก็ได้ แต่แนะนำให้ใส่
        }
        
        cb(null, uploadPath); // กำหนด Destination ไปที่ Path จริง
    },
    filename: (req, file, cb) => {
        cb(null, req.session.userId + '-profile-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
});

// middleware ดึงข้อมูล user จาก session ก่อน render
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

router.get('/', isUser, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const equipments = await Equipment.find({ deleted_at: null }).populate('category_id');
    const borrows = await Borrow.find({ user_id: req.session.userId })
      .populate('equipment_id')
      .populate('user_id')
      .sort({ created_at: -1 });
    
    // ดึงข้อมูล repair requests ของ user คนนี้
    const repairRequests = await RepairRequest.find({ user_id: req.session.userId })
      .populate('equipment_id')
      .sort({ created_at: -1 });
    
    // สร้าง Map เพื่อเช็กว่าอุปกรณ์ไหนมีการแจ้งซ่อมแล้วบ้าง (และยังไม่เสร็จ)
    const equipmentRepairStatus = {};
    repairRequests.forEach(repair => {
      if (repair.equipment_id && repair.status !== 'completed' && repair.status !== 'rejected') {
        equipmentRepairStatus[repair.equipment_id._id.toString()] = repair.status;
      }
    });
    
    res.render('indexUser', {
      title: 'หน้าหลัก User',
      name: `${user.fname} ${user.lname}`,
      layout: 'layouts/navuser',
      activePage: 'dashboard',
      user: user,
      equipments: equipments,
      borrows: borrows,
      repairRequests: repairRequests,
      equipmentRepairStatus: equipmentRepairStatus,
      getRepairStatusBadge: getRepairStatusBadge
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
      getRepairStatusBadge: getRepairStatusBadge 
    });
  }
});

const bcrypt = require('bcryptjs');

const ensureUserId = (req, res, next) => {
  if (!req.session.userId) {
    // หากไม่มี ID ให้กลับไปหน้า Login
    return res.redirect('/');
  }
  next();
};
// 1. GET /setting (เมื่อเข้าถึงผ่าน /users/setting) - แสดงหน้าการตั้งค่า
router.get('/setting', isUser, ensureUserId, async (req, res) => {
  const userId = req.session.userId;

    try {
        const user = await User.findById(userId)
        .select('-password')
        .populate('department'); 
        const departments = await Department.find({ deleted_at: null }).select('name');  
        if (!user) {
            return res.status(404).send("User data not found in database.");
        }
        
        
        // ส่งข้อมูลผู้ใช้ไปยัง view 'settings.ejs'
        res.render('settings', { 
            title: 'การตั้งค่าผู้ใช้', 
            name: req.session.userName,
            user: user,
            departments: departments,
            layout: 'layouts/navuser',
            activePage: 'setting',
            req: req
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});


// 2. POST /setting (สำหรับแก้ไขข้อมูลส่วนตัว)
router.post('/setting', isUser, ensureUserId, upload.single('userProfileImage'), async (req, res) => {
    const userId = req.session.userId;
    const { fname, lname, email, department } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).send("User not found");
        
        user.fname = fname;
        user.lname = lname;
        user.email = email;
        user.department = department && department !== '' ? department : null;



        // 📢 โค้ดที่แก้ไขแล้ว: จัดการการอัปโหลดรูปโปรไฟล์และการลบรูปเก่า
        if (req.file) {
            // A. ถ้ามีไฟล์ใหม่ถูกอัปโหลด: เตรียมลบไฟล์เก่า
            const oldPath = user.userProfile;
            
            // ตรวจสอบว่า Path เก่าเป็นรูปภาพที่อัปโหลดไว้ (ไม่ใช่ URL Avatar)
            if (oldPath && oldPath.startsWith('/uploads/')) {
                
                // 🛠️ แก้ไข Path การลบไฟล์เก่า: ตัด 'public' ออก และใช้ Path ที่ถูกต้องตามโครงสร้างโปรเจกต์
                // oldPath.substring(1) จะได้ "uploads/ชื่อไฟล์.jpg"
                const fullPath = path.join(__dirname, '..', oldPath.substring(1)); 
                
                // ใช้ fs.unlink ในการลบ
                fs.unlink(fullPath, (err) => {
                    if (err) {
                        console.error(`ERROR: ไม่สามารถลบไฟล์เก่า (${fullPath}) ได้:`, err);
                    } else {
                        console.log(`ลบไฟล์เก่าสำเร็จ: ${fullPath}`);
                    }
                });
            }

            // B. บันทึก Path รูปใหม่
            user.userProfile = '/uploads/' + req.file.filename; 
            console.log(`User ID ${userId} อัปโหลดรูปใหม่: ${user.userProfile}`);
        } 
        // ❌ ลบส่วน else { ... } ออกไปแล้ว
        // การทำแบบนี้จะทำให้: 
        // 1. ถ้าไม่ได้อัปโหลดรูปใหม่ (req.file เป็น undefined) 
        // 2. user.userProfile จะ **คงค่าเดิม** ไว้ในฐานข้อมูล รูปจึงไม่หาย

        await user.save();

        req.session.userName = `${fname} ${lname}`;
        res.redirect('/users/setting?msg=updated');

    } catch (err) {
        console.error("Error in /users/setting POST:", err);
        res.redirect('/users/setting?err=updatefail');
    }
});

// 3. POST /setting/password (สำหรับเปลี่ยนรหัสผ่าน)
router.post('/setting/password', isUser, ensureUserId, async (req, res) => {
    const userId = req.session.userId;
    
    // ✅ แก้ไข: เปลี่ยน 'oldPassword' เป็น 'currentPassword' 
    // เพื่อให้ตรงกับ name="currentPassword" ในฟอร์ม settings.ejs
    const { currentPassword, newPassword } = req.body; 

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).send("User not found");

        // 1. ตรวจสอบรหัสผ่านเดิม (ใช้ currentPassword)
        const isMatch = await bcrypt.compare(currentPassword, user.password); 
        if (!isMatch) {
            // รหัสผ่านเดิมไม่ถูกต้อง
            // EJS จะแสดง Modal: 'รหัสผ่านเดิมไม่ถูกต้อง! โปรดลองใหม่อีกครั้ง'
            return res.redirect('/users/setting?err=wrongpass');
        }

        // 2. เข้ารหัสและบันทึกรหัสผ่านใหม่
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        await user.save(); // บันทึกรหัสผ่านใหม่สำเร็จแล้ว

        // 3. Redirect กลับไปที่หน้า Setting เดิมพร้อม Query Message
        // EJS จะแสดง Modal: 'เปลี่ยนรหัสผ่านสำเร็จ! คุณเปลี่ยนรหัสผ่านเรียบร้อยแล้ว'
        return res.redirect('/users/setting?msg=password_changed'); 
        
    } catch (err) {
        console.error("Error changing user password:", err);
        // แสดงข้อผิดพลาดทั่วไป
        // EJS จะแสดง Modal: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล โปรดลองใหม่อีกครั้ง'
        res.redirect('/users/setting?err=updatefail'); 
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


router.get("/notifications", isUser, function (req, res, next) {
  res.render("notificationsUser", {
    title: "การแจ้งเตือน",
    name: req.session.userName,
    layout: 'layouts/navuser',
    activePage: 'notifications'
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
  const search = req.query.search || '';

  try {
    let query = { user_id: userId };

    // ถ้ามีคำค้นหา ให้เพิ่มเงื่อนไขค้นหาใน populate
    if (search) {
      const borrows = await Borrow.find(query)
        .populate('equipment_id')
        .sort({ created_at: -1 });

      console.log(borrows.map(b => ({
        image: b.equipment_id?.image
      })));

      const filteredBorrows = borrows.filter(b =>
        b.equipment_id?.name?.toLowerCase().includes(search.toLowerCase())


      );

      return res.render('userBorrowHistory', {
        title: 'ประวัติการยืม',
        borrows: filteredBorrows,
        getStatusBadge: getStatusBadge,
        layout: 'layouts/navuser',
        activePage: 'borrowreturn',
        search: search
      });
    }

    // ถ้าไม่มีการค้นหาให้ดึงข้อมูลทั้งหมด
    const borrows = await Borrow.find(query)
      .populate('equipment_id')
      .sort({ created_at: -1 });

    res.render('userBorrowHistory', {
      title: 'ประวัติการยืม',
      borrows: borrows,
      getStatusBadge: getStatusBadge,
      layout: 'layouts/navuser',
      activePage: 'borrowreturn',
      search: ''
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
    case 'waitingForReturn':
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

router.post('/repair/:equipmentId', isUser, async (req, res) => {
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
      issue_description: issue_description,
      status: 'pending', // สถานะเริ่มต้น
      created_at: new Date(),
    });

    await newRepair.save();

    res.redirect('/users?msg=repair_submitted');
  } catch (err) {
    console.error('Error creating repair request:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูลแจ้งซ่อม');
  }
});


module.exports = router;