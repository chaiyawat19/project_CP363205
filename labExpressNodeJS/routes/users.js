const express = require('express');
const router = express.Router();
const { isUser } = require('../middleware/auth');
const Equipment = require('../models/listEquipment');
const User = require('../models/User');
const Category = require('../models/Category');
const Borrow = require('../models/Borrow');
const Department = require('../models/Department');;

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
        
        // อัปเดต userName ใน Session
        req.session.userName = `${fname} ${lname}`;
        
        res.redirect('/users/setting?msg=updated');
        
    } catch (err) {
        console.error(err);
        res.redirect('/users/setting?err=updatefail');
    }
});


// 3. POST /setting/password (สำหรับเปลี่ยนรหัสผ่าน)
router.post('/setting/password', isUser, ensureUserId, async (req, res) => {
    const userId = req.session.userId;
    const { oldPassword, newPassword } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).send("User not found");

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.redirect('/users/setting?err=wrongpass');
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        await user.save(); // บันทึกรหัสผ่านใหม่สำเร็จแล้ว

        // 📢 โค้ดที่ต้องแก้ไข: ทำลาย Session ทันที
        req.session.destroy(err => {
            if (err) {
                console.error(err);
                return res.redirect('/users/setting?err=pass_fail');
            }
            // ลบ cookie ด้วย (ถ้าใช้ connect-session)
            res.clearCookie('connect.sid'); 
            
            // 📢 Redirect ไปหน้า Login หรือหน้าแรก เพื่อให้ผู้ใช้ล็อกอินใหม่
            return res.redirect('/?msg=password_changed_login'); 
        });
        
        // ❌ ลบบรรทัดเดิมนี้ออก เพราะการ Redirect ต้องอยู่ใน req.session.destroy
        // res.redirect('/users/setting?msg=password_changed');

    } catch (err) {
        console.error(err);
        res.redirect('/users/setting?err=pass_fail');
    }
});



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
    const search = req.query.search || ''; // ดึงค่าค้นหาจาก query string

    try {
        let query = { user_id: userId };

        // ถ้ามีคำค้นหา ให้เพิ่มเงื่อนไขค้นหาใน populate
        if (search) {
            const borrows = await Borrow.find(query)
                .populate('equipment_id')
                .sort({ created_at: -1 });

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