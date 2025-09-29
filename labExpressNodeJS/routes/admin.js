var express = require("express");
var router = express.Router();
var Category = require("../models/Category");
const { isAdmin } = require ('../middleware/auth');
const listEquipment = require("../models/listEquipment");
const upload = require("../middleware/upload");

router.get('/', isAdmin, (req, res) => {
  res.render('indexAdmin', { 
    title: 'หน้าหลัก Admin', 
    name: req.session.userName , 
    layout: 'layouts/navadmin',
    activePage: 'dashboard'
  });
});

router.get('/listitemuser', isAdmin, (req, res) => {
  res.render('equipmentAdmin', { 
    title: 'รายการอุปกรณ์',
    name: req.session.userName , 
    layout: 'layouts/navadmin',
    activePage: 'listitemuser'
  });
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
      activePage: 'addEquipment',
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

module.exports = router;
