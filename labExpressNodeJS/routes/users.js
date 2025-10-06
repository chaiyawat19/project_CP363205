const express = require('express');
const router = express.Router();
const { isUser } = require('../middleware/auth');
const Equipment = require('../models/listEquipment');
const User = require('../models/User');
const Category = require('../models/Category');
const Borrow = require('../models/Borrow');

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
        const user = await User.findById(userId).select('-password'); 
        if (!user) {
            return res.status(404).send("User data not found in database.");
        }
        
        // ส่งข้อมูลผู้ใช้ไปยัง view 'settings.ejs'
        res.render('settings', { 
            title: 'การตั้งค่าผู้ใช้', 
            name: req.session.userName,
            user: user,
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