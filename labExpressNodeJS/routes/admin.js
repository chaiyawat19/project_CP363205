var express = require("express");
var router = express.Router();
var Category = require("../models/Category");
const { isAdmin,  } = require ('../middleware/auth');
const listEquipment = require("../models/listEquipment");
const Notification = require("../models/Notification");
const Department = require('../models/Department');
const Borrow = require("../models/Borrow")
const User = require('../models/User');
var RepairRequest = require("../models/Reqair_requests");
const mongoose = require("mongoose");
var bcrypt = require("bcryptjs");
const Equipment = require('../models/listEquipment');
const multer = require('multer');
const path = require('path');
const fs = require('fs')

// ใน routes/users.js (ส่วนบนสุด หลังจากการ require Modules ต่างๆ)

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // ใช้ path.join เพื่อสร้าง Path ที่ถูกต้อง: [Root Project]/uploads
        const uploadPath = path.join(__dirname, '..', 'uploads');
        
        // 📢 สำคัญ: ตรวจสอบและสร้างโฟลเดอร์ uploads (ถ้ายังไม่มี)
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        // กำหนด Destination ไปที่ Path ที่สร้างขึ้น
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // ตั้งชื่อไฟล์: user ID - profile - timestamp . นามสกุลเดิม
        cb(null, req.session.userId + '-profile-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});



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
        const user = await User.findById(userId)
        .select('-password')
        .populate('department'); 

        const departments = await Department.find({ deleted_at: null }).select('name'); 
        
        if (!user) {
            return res.status(404).send("User data not found in database.");
        }
        

        // ส่งข้อมูลผู้ใช้ไปยัง view 'settings.ejs'
        res.render('settingsAdmin', { 
            title: 'การตั้งค่าผู้ดูแลระบบ', 
            name: req.session.userName,
            user: user,
            departments: departments,
            layout: 'layouts/navadmin',
            activePage: 'setting',
            req: req
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});


router.post('/setting', isAdmin, ensureUserId, upload.single('userProfileImage'), async (req, res) => {
    const userId = req.session.userId;
    const { fname, lname, email, department } = req.body;
    
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).send("User not found");
        
        user.fname = fname;
        user.lname = lname;
        user.email = email;
        user.department = department; // อัปเดตแผนก (เป็น ID)

        // 📢 NEW: จัดการการอัปโหลดรูปโปรไฟล์และการลบรูปเก่า
        if (req.file) {
            // A. เตรียมลบไฟล์เก่า
            const oldPath = user.userProfile;
            if (oldPath && oldPath.startsWith('/uploads/')) {
                // สร้าง Path จริงของไฟล์: (ตำแหน่งปัจจุบัน)/(กลับไปหนึ่งขั้น)/public/uploads/ชื่อไฟล์.jpg
                const fullPath = path.join(__dirname, '..', 'public', oldPath); 
                
                // ใช้ fs.unlink ในการลบ
                fs.unlink(fullPath, (err) => {
                    if (err) {
                        console.error(`ERROR: ไม่สามารถลบไฟล์เก่า (${fullPath}) ได้:`, err);
                    } else {
                        console.log(`ลบไฟล์เก่าสำเร็จ: ${oldPath}`);
                    }
                });
            }

            // B. บันทึก Path รูปใหม่
            user.userProfile = '/uploads/' + req.file.filename; 
            console.log(`User ID ${userId} อัปโหลดรูปใหม่: ${user.userProfile}`);
        } else {
            // ถ้าไม่ได้อัปโหลดรูปใหม่ แต่มีการเปลี่ยนชื่อ (อัปเดต URL Avatar)
            user.userProfile = `https://ui-avatars.com/api/?name=${encodeURIComponent(fname)}+${encodeURIComponent(lname)}`;
        }
        
        // ... (โค้ดบันทึกและ redirect เดิม)
        await user.save();
        req.session.userName = `${fname} ${lname}`;
        res.redirect('/admin/setting?msg=updated');
        
    } catch (err) {
        console.error("Error in /admin/setting POST:", err);
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
}});

router.get("/", isAdmin, (req, res) => {
  res.render("indexAdmin", {
    title: "หน้าหลัก Admin",
    name: req.session.userName,
    layout: "layouts/navadmin",
    activePage: "dashboard",
  });
});

router.get("/listitemuser", isAdmin, async (req, res) => {
  try {
    // ดึงข้อมูลอุปกรณ์, populate category_id เพื่อเอาชื่อหมวดหมู่
    const listEqt = await listEquipment
      .find({ deleted_at: null })
      .populate("category_id");

    res.render('equipmentAdmin', {
      title: 'รายการอุปกรณ์',
      name: req.session.userName,
      layout: 'layouts/navadmin',
      activePage: 'listitemuser',
      equipmentList: listEqt
    });

    res.render("equipmentAdmin", {
      title: "รายการอุปกรณ์",
      name: req.session.userName,
      layout: "layouts/navadmin",
      activePage: "listitemuser",
      equipmentList: listEqt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
  }
});

router.get("/addEquipment", isAdmin, async (req, res) => {
  try {
    // ดึง categories จาก DB
    const categories = await Category.find({ deleted_at: null });

    console.log(categories); // ตอนนี้จะเป็น array ของ categories จริง ๆ

    res.render("addEquipmentAdmin", {
      title: "เพิ่มอุปกรณ์",

      name: req.session.userName,
      layout: "layouts/navadmin",
      activePage: "listitemuser",
      categories: categories, // ส่งไปที่ view
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
  }
});


router.post(
  "/addEquipment",
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      // ดึงค่าจาก body
      const { name, category_id, description, location } = req.body;
      const adminId = req.session.userId; // ได้จาก middleware isAdmin

      // ไฟล์รูป (ถ้ามี)
      const image = req.file ? req.file.filename : null;

      // สร้างอุปกรณ์ใหม่
      const newEquipment = new listEquipment({
        name,
        category_id,
        description,
        status: "available", // ค่า default
        image,
        location,
      });

      await newEquipment.save();

      // เตรียมข้อความแจ้งเตือน
      const message = `มีการเพิ่มอุปกรณ์ใหม่: ${name}`;
      const reason = "";
      // const equipmentLink = `${baseUrl}/equipment/${newEquipment._id}`;
      // ดึง user ทั้งหมด
      const users = await User.find({}, "_id");

      // สร้าง array ของ notification สำหรับแต่ละ user
      const notifications = users.map((u) => ({
        user_id: u._id,
        equipment_id: newEquipment._id, // ใช้ id ของอุปกรณ์ที่เพิ่งสร้าง
        message,
        reason,
        admin_id: adminId,
      }));

      // บันทึกแจ้งเตือนทั้งหมดในครั้งเดียว
      await Notification.insertMany(notifications);
      res.redirect("/admin/listitemuser");

      // ส่ง response กลับ
      res.status(201).json({
        message: "เพิ่มอุปกรณ์และส่งการแจ้งเตือนให้ผู้ใช้ทั้งหมดแล้ว",
        equipment: newEquipment,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์" });
    }
  }
);


router.get("/equipmentDetail/:id", isAdmin, async (req, res) => {
  try {
    const equipmentId = req.params.id;
    const equipment = await listEquipment
      .findById(equipmentId)
      .populate("category_id");
    const categories = await Category.find({ deleted_at: null });
    if (!equipment) {
      return res.status(404).send("ไม่พบอุปกรณ์");
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

router.get("/editEquipment/:id", isAdmin, async (req, res) => {
  try {
    const equipmentId = req.params.id;
    const equipment = await listEquipment
      .findById(equipmentId)
      .populate("category_id");
    const categories = await Category.find({ deleted_at: null });
    if (!equipment) {
      return res.status(404).send("ไม่พบอุปกรณ์");
    }
    res.render("editEquipmentAdmin", {
      title: equipment.name,
      layout: "layouts/navadmin",
      activePage: "listitemuser",
      equipment,
      categories,
      selectedCategoryId: equipment.category_id
        ? equipment.category_id._id
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
  }
});

router.post(
  "/editEquipment",
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { id, name, category_id, description, status, location } = req.body;
      console.log("Editing equipment ID:", id);
      const image = req.file ? req.file.filename : null;
      const equipment = await listEquipment.findById(id);
      if (!equipment) {
        return res.status(404).send("ไม่พบอุปกรณ์");
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
      res.redirect("/admin/equipmentDetail/" + id);
    } catch (err) {
      console.error(err);
      res.status(500).send("เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
    }
  }
);

router.get("/deleteEquipment/:id", isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const equipment = await listEquipment.findById(id);
    if (!equipment) {
      return res.status(404).send("ไม่พบอุปกรณ์");
    }
    equipment.deleted_at = new Date();
    equipment.status = "unavailable"; // เปลี่ยนสถานะเป็น unavailable
    await equipment.save();
    res.redirect("/admin/listitemuser");
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการลบข้อมูล");
  }
});

// GET /admin/deletedEquipment
router.get("/deletedEquipment", isAdmin, async (req, res) => {
  try {
    // ดึงเฉพาะอุปกรณ์ที่ถูก soft delete
    const deletedEquipmentList = await listEquipment
      .find({ deleted_at: { $ne: null } })
      .populate("category_id");

    res.render("deletedEquipmentAdmin", {
      title: "รายการอุปกรณ์ที่ถูกลบ",
      layout: "layouts/navadmin",
      activePage: "listitemuser",
      deletedEquipmentList,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์ที่ถูกลบ");
  }
});

router.post("/restoreEquipment/:id", isAdmin, async (req, res) => {
  try {
    const equipment = await listEquipment.findById(req.params.id);
    if (!equipment) return res.status(404).send('ไม่พบอุปกรณ์');
    equipment.status = 'available';
    equipment.deleted_at = null;
    await equipment.save();
    res.redirect('/admin/deletedEquipment');
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการกู้คืนอุปกรณ์");
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {

    if (err) {
      console.error(err);
      return res.redirect("/");
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
    res.clearCookie("connect.sid"); // ลบ cookie ออกด้วย
    res.redirect("/"); // กลับไปหน้า login หรือหน้าแรก
  });
});

router.get("/listcategory", isAdmin, async (req, res) => {
  try {
    const categories = await Category.find({ deleted_at: null });
    res.render("listCategoryAdmin", {
      title: "ประเภทอุปกรณ์",
      layout: "layouts/navadmin",
      activePage: "listitemuser",
      categories: categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
  }
});

router.get("/addCategory", isAdmin, (req, res) => {
  res.render("addCategoryAdmin", {
    title: "เพิ่มประเภทอุปกรณ์",
    layout: "layouts/navadmin",
    activePage: "listitemuser",
  });
});

router.post("/addCategory", isAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    const newCategory = new Category({ name });
    await newCategory.save();
    res.redirect("/admin/listcategory");
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการเพิ่มประเภทอุปกรณ์");
  }
});

router.get('/returnequipment', async (req, res) => {
  try {
    const { status } = req.query; 
    let filter = {};

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ['waitingForReturn', 'returned'] };
    }

    const borrows = await Borrow.find(filter)
      .populate('user_id')
      .populate('equipment_id')
      .sort({ created_at: -1 });

    res.render('returnEquipmentAdmin', {
      title: 'รายการยืนยันการคืนอุปกรณ์',
      layout: 'layouts/navadmin',
      activePage: 'returnEquipment',
      borrows,
      query: req.query, 
      status: ['waitingForReturn', 'returned'],
      statusLabels: {
        waitingForReturn: 'รอคืนอุปกรณ์',
        returned: 'คืนอุปกรณ์แล้ว'
      }
    });
  } catch (err) {
    console.error('❌ Error fetching borrow list:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
});


// ยืนยันการคืนอุปกรณ์
router.post('/confirmreturn/:id', async (req, res) => {
  try {
    const borrowId = req.params.id;
    const { note, condition } = req.body;

    if (!borrowId) {
      console.error("❌ Missing borrowId");
      return res.status(400).send('ไม่มีรหัสรายการยืม');
    }
 
    const borrow = await Borrow.findById(borrowId);
    if (!borrow) {
      console.error("❌ Borrow record not found");
      return res.status(404).send('ไม่พบข้อมูลการยืม');
    }

    if (!borrow.equipment_id) {
      console.error("❌ Missing equipment_id in borrow");
      return res.status(400).send('ไม่พบอุปกรณ์ที่เกี่ยวข้อง');
    }

    borrow.status = 'returned';
    borrow.note = note || '';
    borrow.actual_return_date = new Date();
    await borrow.save();

    let newStatus = 'available';
    if (condition === 'เสียหาย') newStatus = 'broken';
    if (condition === 'สูญหาย') newStatus = 'unavailable';

    await Equipment.findByIdAndUpdate(borrow.equipment_id, { status: newStatus });

    console.log(`อัปเดตการคืนสำเร็จ: borrow=${borrowId}, equipment=${borrow.equipment_id}, status=${newStatus}`);
    res.redirect('/admin/returnequipment');
  } catch (err) {
    console.error('❌ Error confirming return:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการยืนยันการคืนอุปกรณ์');
  }
});



//บอล
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

router.get("/borrow_Details/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const borrow = await Borrow.findById(id)
      .populate('user_id')
      .populate('equipment_id')
      .lean();

    if (!borrow) return res.status(404).send("ไม่พบข้อมูลการยืม");

    res.render("borrowEquipmentDetails", {
      title: "รายละเอียดการยืมอุปกรณ์",
      formatThaiDate,
      layout: "layouts/navadmin",
      activePage: "borrowEquipment",
      borrow: borrow 
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์");
  }
});
router.post("/borrow/update/:id", async (req, res) => {
  try {
    const id = req.params.id;

    await Borrow.findByIdAndUpdate(id, {
      status: "borrowed", 
      return_date: req.body.Date, 
      note: req.body.note,   
    });

    res.redirect("/admin/Borrowequipment"); 
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
  }
});
router.get("/borrow/reject/:id", async (req, res) => {
  try {
    const id = req.params.id;

    await Borrow.findByIdAndUpdate(id, {
      status: "rejected", 
    });
    res.redirect("/admin/Borrowequipment"); 
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
  }
});

// ฟังก์ชันช่วยแปลงวันที่เป็นรูปแบบไทย
function formatThaiDate(date) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// หน้าแสดงรายการทั้งหมด หรือกรองได้ด้วย query params
router.get("/reqair_requestsadmin", async (req, res, next) => {
  try {
    const q = req.query.q ? req.query.q.trim() : "";
    const month = (req.query.month || "").trim(); 
    const year = (req.query.year || "").trim();
    const status = (req.query.status || "").trim();

    let queryCondition = {};

    // กรองตามสถานะ
    if (status) {
      queryCondition.status = status;
    }

    // ⭐ กรองตามเดือนและปี (แก้ใหม่)
    if (year && month) {
      // กรณี 1: เลือกทั้งปีและเดือน (เช่น ปี 2025 + มกราคม)
      const monthNum = parseInt(month);
      const startDate = new Date(parseInt(year), monthNum - 1, 1, 0, 0, 0);
      const endDate = new Date(parseInt(year), monthNum, 0, 23, 59, 59, 999);
      queryCondition.created_at = { $gte: startDate, $lte: endDate };
      
    } else if (!year && month) {
      // ⭐ กรณี 2: เลือก "ปีทั้งหมด" + เลือกเดือน (เช่น มกราคม ของทุกปี)
      const monthNum = parseInt(month);
      queryCondition.$expr = {
        $eq: [{ $month: "$created_at" }, monthNum]
      };
      
    } else if (year && !month) {
      // กรณี 3: เลือกแค่ปี ไม่เลือกเดือน (แสดงทั้งปี)
      const startDate = new Date(parseInt(year), 0, 1, 0, 0, 0);
      const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
      queryCondition.created_at = { $gte: startDate, $lte: endDate };
    }
    // กรณี 4: ไม่เลือกทั้งปีและเดือน = แสดงข้อมูลทั้งหมด (ไม่มี queryCondition.created_at)

    // ดึงข้อมูลจากฐานข้อมูล
    let items = await RepairRequest.find(queryCondition)
      .sort({ created_at: -1 })
      .populate("equipment_id", "name status location")
      .populate("user_id", "fname lname email")
      .lean();

    // กรองข้อมูลด้วยคำค้น
    if (q) {
      const qLower = q.toLowerCase();
      items = items.filter((it) => {
        const userFullName = it.user_id
          ? `${it.user_id.fname} ${it.user_id.lname}`.toLowerCase()
          : "";
        const equipmentName = it.equipment_id
          ? it.equipment_id.name.toLowerCase()
          : "";
        const description = it.issue_description
          ? it.issue_description.toLowerCase()
          : "";
        return (
          userFullName.includes(qLower) ||
          equipmentName.includes(qLower) ||
          description.includes(qLower)
        );
      });
    }

    // ดึงรายการปีที่มีในฐานข้อมูล
    const yearsAgg = await RepairRequest.aggregate([
      { $match: { created_at: { $exists: true, $ne: null } } },
      {
        $project: {
          year: { $year: "$created_at" }
        }
      },
      { $group: { _id: "$year" } },
      { $sort: { _id: -1 } }
    ]);

    const availableYears = yearsAgg.map(y => y._id);

    const thaiMonths = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", 
      "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
      "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    // ⭐ สร้างรายการเดือน (แก้ใหม่)
    let monthOptions = [];

    if (year) {
      // กรณีเลือกปี - แสดงเดือนที่มีข้อมูลในปีนั้น
      const monthsInYearAgg = await RepairRequest.aggregate([
        { 
          $match: { 
            created_at: { 
              $gte: new Date(parseInt(year), 0, 1),
              $lte: new Date(parseInt(year), 11, 31, 23, 59, 59, 999)
            } 
          } 
        },
        {
          $project: {
            month: { $month: "$created_at" }
          }
        },
        { $group: { _id: "$month" } },
        { $sort: { _id: 1 } }
      ]);

      const availableMonths = monthsInYearAgg.map(m => m._id);

      monthOptions = Array.from({ length: 12 }, (_, i) => {
        const monthNum = (i + 1).toString();
        const label = thaiMonths[i];
        const hasData = availableMonths.includes(i + 1);
        return { value: monthNum, label, hasData };
      });

    } else {
      // ⭐ กรณีเลือก "ปีทั้งหมด" - แสดง 12 เดือนให้เลือก
      // ดึงเดือนที่มีข้อมูลจากทุกปี
      const allMonthsAgg = await RepairRequest.aggregate([
        { $match: { created_at: { $exists: true, $ne: null } } },
        {
          $project: {
            month: { $month: "$created_at" }
          }
        },
        { $group: { _id: "$month" } },
        { $sort: { _id: 1 } }
      ]);

      const availableMonths = allMonthsAgg.map(m => m._id);

      monthOptions = Array.from({ length: 12 }, (_, i) => {
        const monthNum = (i + 1).toString();
        const label = thaiMonths[i];
        const hasData = availableMonths.includes(i + 1);
        return { value: monthNum, label, hasData };
      });
    }

    // ส่งไปหน้า view
    res.render("reqair_requestsadmin", {
      title: "รายการคำร้องซ่อม (Admin)",
      items,
      query: { q, month, year, status },
      years: availableYears,
      months: monthOptions,
      statuses: ["pending", "in_progress", "completed", "rejected"],
      statusLabels: {
        pending: "รอดำเนินการ",
        in_progress: "กำลังดำเนินการ",
        completed: "เสร็จสิ้น",
        rejected: "ยกเลิก",
      },
      layout: "layouts/navadmin",
      activePage: "/admin/reqair_requestsadmin",
      formatThaiDate,
      noResults: q && items.length === 0,
    });
  } catch (err) {
    console.error("Error in reqair_requestsadmin:", err);
    next(err);
  }
});

// ดูรายละเอียดคำร้อง
router.get("/reqair_requests_detailadmin/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const item = await RepairRequest.findById(id)
      .populate("equipment_id", "name status location image")
      .populate("user_id", "fname lname email")
      .lean();

    if (!item) return res.status(404).send("ไม่พบคำร้อง");

    res.render("reqair_requests_detailAdmin", {
     title: "รายละเอียดคำร้องซ่อม",
      item,
      formatThaiDate,
      layout: "layouts/navadmin",
      activePage: "/admin/reqair_requestsadmin",
    });
  } catch (err) {
    next(err);
  }
});

const ALLOWED_STATUS = ["pending", "in_progress", "completed", "rejected"];

router.post("/reqair_requests_detailadmin/:id/reply", async (req, res, next) => {
    try {
      const id = req.params.id; //ดึงค่า id จาก URL (เช่น “652f1b87d3...”)
      

      const { admin_comment, status, completion_date } = req.body;

      // Validate status ถ้ามีค่าเข้ามา
      let newStatus = undefined;
      if (typeof status === "string" && status.trim() !== "") {
        if (!ALLOWED_STATUS.includes(status)) {
          if (
            req.headers.accept &&
            req.headers.accept.includes("application/json")
          ) {
            return res
              .status(400)
              .json({ success: false, message: "Invalid status value" });
          }
          return res.status(400).send("Invalid status value");
        }
        newStatus = status;
      }

      // แปลงวันที่ completion_date (ถามมาเป็น '' ให้ถือเป็น null)
      let completionDate = undefined;
      if (completion_date && completion_date !== "") {
        const dt = new Date(completion_date);
        if (isNaN(dt)) {
          if (
            req.headers.accept &&
            req.headers.accept.includes("application/json")
          ) {
            return res
              .status(400)
              .json({ success: false, message: "Invalid completion_date" });
          }
          return res.status(400).send("Invalid completion_date");
        }
        completionDate = dt;
      } else if (completion_date === "") {
        // ถ้าส่งเป็นสตริงว่าง แปลว่าลบวันที่
        completionDate = null;
      }

      // เตรียม object สำหรับอัปเดต
      const update = {
        // อัปเดต admin_comment เสมอ (กันกรณีไม่มีการส่งให้ ก็ไม่เปลี่ยน)
      };
      
      if (typeof admin_comment !== "undefined")
        update.admin_comment = admin_comment;
      if (typeof newStatus !== "undefined") update.status = newStatus;
      if (typeof completionDate !== "undefined")
        update.completion_date = completionDate;

      // อัปเดต updated_at ให้เป็นเวลาปัจจุบัน (ถ้ามี field ใน schema)
      update.updated_at = new Date();

      // ถ้าไม่มีอะไรจะอัพเดท ให้ตอบกลับ
      if (Object.keys(update).length === 0) {
        if (
          req.headers.accept &&
          req.headers.accept.includes("application/json")
        ) {
          return res.json({
            success: false,
            message: "ไม่มีข้อมูลที่จะอัพเดท",
          });
        }
        return res.redirect(`/admin/reqair_requestsadmin/${id}`);
      }

      const updated = await RepairRequest.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true }
      );

      if (!updated) {
        if (
          req.headers.accept &&
          req.headers.accept.includes("application/json")
        ) {
          return res
            .status(404)
            .json({ success: false, message: "ไม่พบคำร้อง" });
        }
        return res.status(404).send("ไม่พบคำร้อง");
      }

      // ตอบกลับแบบ JSON ถ้า request มาจาก API
      if (
        req.headers.accept &&
        req.headers.accept.includes("application/json")
      ) {
        return res.json({ success: true, item: updated });
      }

      // สำหรับ form submit ให้ redirect กลับไปที่หน้า detail พร้อม query message
      return res.redirect(`/admin/reqair_requestsadmin?message=บันทึกสำเร็จ`);
    } catch (err) {
      next(err);
    }
  }
);

// แสดงรายการผู้ใช้
router.get("/manage_user", isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.render("manage_user", {
      title: "จัดการผู้ใช้",
      layout: "layouts/navadmin",
      activePage: "manage_user",
      users: users,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
  }
});

// หน้าเพิ่มผู้ใช้ใหม่
router.get("/manage_user/add", isAdmin, async (req, res) => {
  try {
    // กรองเฉพาะแผนกที่ยังไม่ถูกลบ
    const departments = await Department.find({ deleted_at: null }).sort({ name: 1 });
    
    res.render("add_user", {
      title: "เพิ่มผู้ใช้ใหม่",
      layout: "layouts/navadmin",
      activePage: "manage_user",
      departments: departments
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาด");
  }
});

router.post("/manage_user/add", isAdmin, async (req, res) => {
  try {
    const { fname, lname, email, password, userRole, department } = req.body;

    console.log("=== เริ่มเพิ่มผู้ใช้ ===");
    console.log("ข้อมูลที่ได้รับ:", { fname, lname, email, userRole, department });

    // ตรวจสอบข้อมูลครบหรือไม่
    if (!fname || !lname || !email || !password) {
      console.log("ข้อมูลไม่ครบ");
      return res.status(400).send("กรุณากรอกข้อมูลให้ครบถ้วน");
    }

    // ตรวจสอบ email ซ้ำ
    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      console.log("Email ซ้ำ:", email);
      return res.status(400).send("อีเมลนี้มีในระบบแล้ว");
    }

    // เข้ารหัสรหัสผ่านด้วย bcrypt
    console.log("กำลังเข้ารหัสรหัสผ่าน...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("เข้ารหัสสำเร็จ");

    // สร้าง user object
    const newUser = new User({
      fname: fname.trim(),
      lname: lname.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      userProfile: `https://ui-avatars.com/api/?name=${encodeURIComponent(fname)}+${encodeURIComponent(lname)}`,
      userRole: userRole || 'user',
      department: department && department.trim() !== '' ? department.trim() : null, // เก็บเป็น null ถ้าไม่เลือก
    });

    console.log("กำลังบันทึกข้อมูล...");
    await newUser.save();
    console.log("บันทึกสำเร็จ! User ID:", newUser._id);

    res.redirect("/admin/manage_user");
  } catch (err) {
    console.error("=== เกิดข้อผิดพลาด ===");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    
    res.status(500).send(`เกิดข้อผิดพลาด: ${err.message}`);
  }
});

router.get("/manage_user/edit/:id", isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).send("ไม่พบผู้ใช้");
    }

    // กรองเฉพาะแผนกที่ยังไม่ถูกลบ
    const departments = await Department.find({ deleted_at: null }).sort({ name: 1 });

    res.render("edit_user", {
      title: "แก้ไขข้อมูลผู้ใช้",
      layout: "layouts/navadmin",
      activePage: "manage_user",
      user: user,
      departments: departments
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาด");
  }
});

// อัปเดตข้อมูลผู้ใช้
router.post("/manage_user/edit/:id", isAdmin, async (req, res) => {
  try {
    const { fname, lname, email, userRole, department } = req.body;

    console.log("=== เริ่มอัปเดตผู้ใช้ ===");
    console.log("ข้อมูลที่ได้รับ:", { fname, lname, email, userRole, department });

    // ตรวจสอบข้อมูลครบหรือไม่
    if (!fname || !lname || !email || !userRole) {
      return res.status(400).send("กรุณากรอกข้อมูลให้ครบถ้วน");
    }

    // ตรวจสอบ email ซ้ำ (ยกเว้น user ที่กำลังแก้ไข)
    const existingUser = await User.findOne({ 
      email: email.trim().toLowerCase(),
      _id: { $ne: req.params.id } // ไม่รวม user ที่กำลังแก้ไข
    });
    
    if (existingUser) {
      return res.status(400).send("อีเมลนี้มีในระบบแล้ว");
    }

    // อัปเดตข้อมูล
    const updateData = {
      fname: fname.trim(),
      lname: lname.trim(),
      email: email.trim().toLowerCase(),
      userRole,
      department: department && department.trim() !== '' ? department.trim() : null,
      userProfile: `https://ui-avatars.com/api/?name=${encodeURIComponent(fname)}+${encodeURIComponent(lname)}`,
    };

    await User.findByIdAndUpdate(req.params.id, updateData);
    
    console.log("อัปเดตสำเร็จ!");
    res.redirect("/admin/manage_user");
    
  } catch (err) {
    console.error("=== เกิดข้อผิดพลาด ===");
    console.error("Error:", err.message);
    res.status(500).send(`เกิดข้อผิดพลาด: ${err.message}`);
  }
});


// ลบผู้ใช้และข้อมูลการยืมทั้งหมดที่เกี่ยวข้อง
router.post("/manage_user/delete/:id", isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // ป้องกันไม่ให้ลบตัวเอง
    if (req.session && req.session.userId === userId) {
      return res.status(400).send("ไม่สามารถลบบัญชีของตัวเองได้");
    }

    // ตรวจสอบว่ามีผู้ใช้อยู่จริงหรือไม่
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("ไม่พบผู้ใช้ที่ต้องการลบ");
    }
    console.log(`ลบผู้ใช้: ${user.fname} ${user.lname}`);

    // แก้ไข: ใช้ user_id แทน userId (ตาม Model)
    const borrowsToDelete = await Borrow.find({ user_id: userId });
    console.log(`พบข้อมูลการยืม: ${borrowsToDelete.length} รายการ`);
    
    if (borrowsToDelete.length > 0) {
      console.log(`\nรายการที่จะลบ:`);
      borrowsToDelete.forEach((borrow, index) => {
        console.log(`  ${index + 1}. Borrow ID: ${borrow._id} | Equipment: ${borrow.equipment_id} | Status: ${borrow.status}`);
      });
    }

    // ลบข้อมูลการยืมทั้งหมด (ใช้ user_id)
    const deletedBorrows = await Borrow.deleteMany({ 
      user_id: userId 
    });
    console.log(`\nลบข้อมูลการยืมสำเร็จ: ${deletedBorrows.deletedCount} รายการ`);

    // ลบผู้ใช้
    await User.findByIdAndDelete(userId);
    console.log(`ลบผู้ใช้สำเร็จ`);
    
    res.redirect("/admin/manage_user");
    
  } catch (err) {
    console.error("Error Message :", err.message);
    res.status(500).send(`เกิดข้อผิดพลาด: ${err.message}`);
  }
});

// ตรวจสอบรหัสผ่านของ Super Admin
router.post("/verify-superadmin", async (req, res) => {
  try {
    const { password } = req.body;
    console.log("Password from client:", password); // เช็คว่ามีค่ามาจริงหรือไม่

    const superAdmin = await User.findOne({ email: "testadmin@gmail.com" });
    if (!superAdmin) return res.json({ success: false, message: "ไม่พบ Super Admin" });

    const isMatch = await bcrypt.compare(password, superAdmin.password);
    console.log("isMatch:", isMatch); // ต้องเป็น true ถ้ารหัสถูกต้อง

    if (!isMatch) return res.json({ success: false, message: "รหัสผ่านไม่ถูกต้อง" });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  }
});



module.exports = router;


