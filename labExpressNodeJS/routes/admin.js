var express = require("express");
var router = express.Router();
var Category = require("../models/Category");
const { isAdmin,  } = require ('../middleware/auth');
const listEquipment = require("../models/listEquipment");
const upload = require("../middleware/upload");

const Borrow = require("../models/Borrow")
const User = require('../models/User');
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
  }});

var RepairRequest = require("../models/Reqair_requests");
const mongoose = require("mongoose");

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

      // ไฟล์รูป (ถ้ามี)
      const image = req.file ? req.file.filename : null;

      // สร้าง object ใหม่
      const newEquipment = new listEquipment({
        name,
        category_id,
        description,
        status: "available", // กำหนดค่า default
        image,
        location,
      });

      await newEquipment.save();

      return res.redirect("/admin/listitemuser");
    } catch (error) {
      console.error(error);
      return res.status(500).send("Internal Server Error");
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
    });

    res.render("equipmentDetailAdmin", {
      title: "รายละเอียดอุปกรณ์",
      layout: "layouts/navadmin",
      activePage: "listitemuser",
      equipment,
      categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
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


// หน้าแสดงรายการยืนยันการคืนอุปกรณ์
router.get('/returnequipment', async (req, res) => {
  try {
    const borrows = await Borrow.find({status: { $in: ['waitingForReturn', 'returned'] }})
      .populate('user_id')
      .populate('equipment_id')
      .sort({ created_at: -1 });

    res.render('returnEquipmentAdmin', {
      title: 'รายการยืนยันการคืนอุปกรณ์',
      layout: 'layouts/navadmin',
      activePage: 'returnEquipment',
      borrows,
      query: req.query,
      statuses: ['waitingForReturn', 'returned'], 
      statusLabels: { 
        waitingForReturn: 'รอคืนอุปกรณ์', 
        returned: 'คืนอุปกรณ์แล้ว'}
    });
  } catch (err) {
    console.error('❌ Error fetching borrow list:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
});

router.post('/confirmreturn/:id', async (req, res) => {
  try {
    const borrowId = req.params.id;
    const { note } = req.body;
    
    await Borrow.findByIdAndUpdate(borrowId, {
      status: 'returned',
      note,
      actual_return_date: new Date()
    });

    res.redirect('/admin/returnequipment');
  } catch (err) {
    console.error('❌ Error confirming return:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการยืนยันการคืนอุปกรณ์');
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

module.exports = router;
