const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // โฟลเดอร์สำหรับเก็บไฟล์
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});


const upload = multer({ storage: storage });

module.exports = upload;



// จัดการการอัปโหลดไฟล์จากผู้ใช้ รับไฟล์จากฟอร์ม เช่น รูปภาพ
// ตั้งชื่อไฟล์ใหม่ให้ไม่ซ้ำกัน บันทึกไฟล์ลงในโฟลเดอร์ที่กำหนด เช่น uploads
// ส่งข้อมูลไฟล์นั้นไปให้ route หรือ controller ใช้ต่อ