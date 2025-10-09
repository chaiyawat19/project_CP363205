var express = require("express");
var router = express.Router();
var Category = require("../models/Category");

const { isAdmin,  } = require ('../middleware/auth');
const listEquipment = require("../models/listEquipment");
const upload = require("../middleware/upload");
const User = require('../models/User');
const Borrow = require('../models/Borrow');
var bcrypt = require("bcryptjs");

const ensureUserId = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login'); 
    }
    next();
};

// middleware ดึงข้อมูล user จาก session ก่อน render
router.use(isAdmin, async (req, res, next) => {
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


// 1. GET /setting (เมื่อเข้าถึงผ่าน /users/setting) - แสดงหน้าการตั้งค่า
router.get('/setting', isAdmin, ensureUserId, async (req, res) => {
    const userId = req.session.userId; 


    try {
        const user = await User.findById(userId).select('-password'); 
        if (!user) {
            return res.status(404).send("User data not found in database.");
        }
        
        // ส่งข้อมูลผู้ใช้ไปยัง view 'settings.ejs'
        res.render('settingsAdmin', { 
            title: 'การตั้งค่าผู้ดูแลระบบ', 
            name: req.session.userName,
            user: user,
            layout: 'layouts/navadmin',
            activePage: 'setting',
            req: req
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});


// 2. POST /setting (สำหรับแก้ไขข้อมูลส่วนตัว)
router.post('/setting', isAdmin, ensureUserId, async (req, res) => {
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
        
        res.redirect('/admin/setting?msg=updated');
        
    } catch (err) {
        console.error(err);
        res.redirect('/admin/setting?err=updatefail');
    }
});

// 3. POST /setting/password (สำหรับเปลี่ยนรหัสผ่าน)
router.post('/setting/password', isAdmin, ensureUserId, async (req, res) => {
    const userId = req.session.userId;
    const { oldPassword, newPassword } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).send("User not found");

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.redirect('/admin/setting?err=wrongpass');
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        await user.save(); // บันทึกรหัสผ่านใหม่สำเร็จแล้ว

        // 📢 โค้ดที่ต้องแก้ไข: ทำลาย Session ทันที
        req.session.destroy(err => {
            if (err) {
                console.error(err);
                return res.redirect('/admin/setting?err=pass_fail');
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
        res.redirect('/admin/setting?err=pass_fail');
    }
});


router.get('/', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).render('indexUser', {
        title: 'ไม่พบข้อมูลผู้ใช้',
        user: null
      });
    }

    res.render('indexAdmin', {
      title: 'หน้าหลัก Admin',
      layout: 'layouts/navadmin',
      activePage: 'dashboard',
      user: user
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).render('indexUser', {
      title: 'เกิดข้อผิดพลาดของระบบ',
      user: null,
    });
  }
});

router.get('/listitemuser', isAdmin, async (req, res) => {
  try {
    // ดึงข้อมูลอุปกรณ์, populate category_id เพื่อเอาชื่อหมวดหมู่
    const listEqt = await listEquipment.find({ deleted_at: null }).populate('category_id');

    res.render('equipmentAdmin', {
      title: 'รายการอุปกรณ์',
      name: req.session.userName,
      layout: 'layouts/navadmin',
      activePage: 'listitemuser',
      equipmentList: listEqt
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
});

router.get('/addEquipment', isAdmin, async (req, res) => {
  try {
    // ดึง categories จาก DB
    const categories = await Category.find({ deleted_at: null });

    console.log(categories); // ตอนนี้จะเป็น array ของ categories จริง ๆ

    res.render('addEquipmentAdmin', {
      title: 'เพิ่มอุปกรณ์',
      name: req.session.userName,
      layout: 'layouts/navadmin',
      activePage: 'listitemuser',
      categories: categories  // ส่งไปที่ view
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
});



router.post("/addEquipment", isAdmin, upload.single('image'), async (req, res) => {
  try {
    // ดึงค่าจาก body
    const { name, category_id, description, location } = req.body;

    // ไฟล์รูป (ถ้ามี)
    const image = req.file ? req.file.filename : null;

    // สร้าง object ใหม่
    const newEquipment = new listEquipment({
      name,
      category_id,
      description,
      status: 'available',   // กำหนดค่า default
      image,
      location
    });

    await newEquipment.save();

    return res.redirect("/admin/listitemuser");

  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal Server Error');
  }
});


router.get('/equipmentDetail/:id', isAdmin, async (req, res) => {
  try {
    const equipmentId = req.params.id;
    const equipment = await listEquipment.findById(equipmentId).populate('category_id');
    const categories = await Category.find({ deleted_at: null });
    if (!equipment) {
      return res.status(404).send('ไม่พบอุปกรณ์');
    }
    res.render('equipmentDetailAdmin', {
      title: 'รายละเอียดอุปกรณ์',
      layout: 'layouts/navadmin',
      activePage: 'listitemuser',
      equipment,
      categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
});

router.get('/editEquipment/:id', isAdmin, async (req, res) => {
  try {
    const equipmentId = req.params.id;
    const equipment = await listEquipment.findById(equipmentId).populate('category_id');
    const categories = await Category.find({ deleted_at: null });
    if (!equipment) {
      return res.status(404).send('ไม่พบอุปกรณ์');
    }
    res.render('editEquipmentAdmin', {
      title: equipment.name,
      layout: 'layouts/navadmin',
      activePage: 'listitemuser',
      equipment,
      categories,
      selectedCategoryId: equipment.category_id ? equipment.category_id._id : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
});


router.post('/editEquipment', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id, name, category_id, description, status, location } = req.body;
    console.log("Editing equipment ID:", id);
    const image = req.file ? req.file.filename : null;
    const equipment = await listEquipment.findById(id);
    if (!equipment) {
      return res.status(404).send('ไม่พบอุปกรณ์');
    }
    equipment.name = name;
    equipment.category_id = category_id;
    equipment.description = description;
    equipment.status = status;
    equipment.location = location;
    if (image) {
      equipment.image = image;
    }
    await equipment.save();
    res.redirect('/admin/equipmentDetail/' + id);
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
  }
});

router.get('/deleteEquipment/:id', isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const equipment = await listEquipment.findById(id);
    if (!equipment) {
      return res.status(404).send('ไม่พบอุปกรณ์');
    }
    equipment.deleted_at = new Date();
    equipment.status = 'unavailable'; // เปลี่ยนสถานะเป็น unavailable
    await equipment.save();
    res.redirect('/admin/listitemuser');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการลบข้อมูล');
  }
});

router.get('/deletedEquipment', isAdmin, async (req, res) => {
  try {
    const deletedEquipmentList = await listEquipment.find({ deleted_at: { $ne: null } }).populate('category_id');
    res.render('deletedEquipmentAdmin', {
      title: 'รายการอุปกรณ์ที่ถูกลบ',
      layout: 'layouts/navadmin',
      activePage: 'listitemuser',
      deletedEquipmentList
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์ที่ถูกลบ');
  }
});

router.post('/restoreEquipment/:id', isAdmin, async (req, res) => {
  try {
    const equipment = await listEquipment.findById(req.params.id);
    if (!equipment) return res.status(404).send('ไม่พบอุปกรณ์');
    equipment.status = 'available';
    equipment.deleted_at = null;
    await equipment.save();
    res.redirect('/admin/deletedEquipment');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการกู้คืนอุปกรณ์');
  }
});



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


router.get('/listcategory', isAdmin, async (req, res) => {
  try {
    const categories = await Category.find({ deleted_at: null });
    res.render('listCategoryAdmin', {
      title: 'ประเภทอุปกรณ์',
      layout: 'layouts/navadmin',
      activePage: 'listitemuser',
      categories: categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
});

router.get('/addCategory', isAdmin, (req, res) => {
  res.render('addCategoryAdmin', {
    title: 'เพิ่มประเภทอุปกรณ์',
    layout: 'layouts/navadmin',
    activePage: 'listitemuser'
  });
});

router.post('/addCategory', isAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    const newCategory = new Category({ name });
    await newCategory.save();
    res.redirect('/admin/listcategory');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการเพิ่มประเภทอุปกรณ์');
  }
});


router.get('/Borrowequipment', isAdmin, async (req, res) => {

  const borrows = await Borrow.find({})
    .populate('equipment_id')
    .populate('user_id')
    .sort({ created_at: -1 });
  res.render('borrowEquipment.ejs', {
    title: 'รายการยืม-คืนอุปกรณ์',
    layout: 'layouts/navadmin',
    activePage: 'borrowEquipment',
    borrows: borrows
  });

});


module.exports = router;
