const express = require('express');
const router = express.Router();
const { isUser } = require('../middleware/auth');
const Equipment = require('../models/listEquipment');
const User = require('../models/User');
const Category = require('../models/Category');
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
    res.clearCookie('connect.sid'); // ลบ cookie ออกด้วย
    res.redirect('/'); // กลับไปหน้า login หรือหน้าแรก
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