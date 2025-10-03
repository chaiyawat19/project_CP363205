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
    const id  = req.params.id;
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

// GET /admin/deletedEquipment
router.get('/deletedEquipment', isAdmin, async (req, res) => {
  try {
    // ดึงเฉพาะอุปกรณ์ที่ถูก soft delete
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

    equipment.status = 'available'; // เปลี่ยนสถานะกลับเป็น available
    equipment.deleted_at = null; // กู้คืน
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
    res.clearCookie('connect.sid'); // ลบ cookie ออกด้วย
    res.redirect('/'); // กลับไปหน้า login หรือหน้าแรก
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

module.exports = router;
