var express = require("express");
var router = express.Router();
var User = require("../models/User");
var bcrypt = require("bcryptjs");
var Borrow = require('../models/Borrow');
var User = require('../models/User');
var Equipment = require('../models/listEquipment');

/* GET home page. */
router.get("/", function (req, res, next) {
  if (req.session && req.session.userId) {
    if (req.session.userRole === 'admin') {
      return res.redirect('/admin');
    } else if (req.session.userRole === 'user') {
      return res.redirect('/users');
    }
  }





  res.render("index", { title: "AssetFlow" });
});

router.get("/login", function (req, res, next) {
  if (req.session && req.session.userId) {
    if (req.session.userRole === 'admin') {
      return res.redirect('/admin');
    } else if (req.session.userRole === 'user') {
      return res.redirect('/users');
    }
  }
  res.render("login", { title: "เข้าสู่ระบบ", layout: "layouts/auth" });
});

router.get("/listitemuser", function (req,res,next){
  if(req.session.userRole === 'admin'){
    return res.redirect('/listitemadmin');
  } else if (req.session.userRole === 'user'){
    return res.redirect('/listitemuser');
  }
})

router.get("/register", function (req, res, next) {
  if (req.session && req.session.userId) {
    if (req.session.userRole === 'admin') {
      return res.redirect('/admin');
    } else if (req.session.userRole === 'user') {
      return res.redirect('/users');
    }
  }
  res.render("register", { title: "สมัครสมาชิก", layout: "layouts/auth" });
});

router.post("/register", async (req, res, next) => {
  const { fname, lname, email, password, confirmPassword } = req.body;
  try {
    if (!fname || !lname || !email || !password || !confirmPassword) {
      return res.render("register", { title: "สมัครสมาชิก", layout: "layouts/auth", error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    }

    if (password !== confirmPassword) {
      return res.render("register", { title: "สมัครสมาชิก", layout: "layouts/auth", error: "รหัสผ่านไม่ตรงกัน" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("register", { title: "สมัครสมาชิก", layout: "layouts/auth", error: "อีเมลนี้ถูกใช้งานแล้ว" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fname,
      lname,
      email,
      password: hashedPassword,
      userProfile: `https://ui-avatars.com/api/?name=${fname}+${lname}`,
      userRole: "user"
    });

    await newUser.save();
    return res.render("register", { title: "เข้าสู่ระบบ", layout: "layouts/auth", success: "สมัครสมาชิกเรียบร้อยแล้ว สามารถเข้าสู่ระบบได้" });

  } catch (error) {
    console.error(error);
    return res.render("register", { title: "สมัครสมาชิก", layout: "layouts/auth", error: "เกิดข้อผิดพลาดของระบบ" });
  }
});

router.post("/login", async (req, res, next) => {
    const { email, password } = req.body;
    const generalError = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"; 
    
    try {
        if (!email || !password) {
            return res.render("login", { 
                title: "เข้าสู่ระบบ", 
                layout: "layouts/auth", 
                error: "กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน"
            });
        }
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.render("login", { 
                title: "เข้าสู่ระบบ", 
                layout: "layouts/auth", 
                error: generalError 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render("login", { 
                title: "เข้าสู่ระบบ", 
                layout: "layouts/auth", 
                error: generalError 
            });
        }

        // สร้าง Session
        req.session.userId = user._id;
        req.session.userRole = user.userRole;
        req.session.userName = user.fname;
        req.session.userEmail = user.email;
        
        // **เปลี่ยนจาก redirect เป็น render พร้อมส่ง success url**
        const redirectUrl = user.userRole === 'admin' ? '/admin' : '/users';
        return res.render("login", { 
            title: "เข้าสู่ระบบ", 
            layout: "layouts/auth",
            success: redirectUrl  // ส่ง URL ที่จะ redirect ไป
        });

    } catch (error) {
        console.error("Login System Error:", error);
        return res.render("login", { 
            title: "เข้าสู่ระบบ", 
            layout: "layouts/auth", 
            error: "เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง" 
        });
    }
});

// route สำหรับ logout
router.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "ไม่สามารถออกจากระบบได้" });
    }
    res.json({ success: true, message: "ออกจากระบบเรียบร้อยแล้ว" });
  });
});

router.get("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/');
    }
    res.redirect('/');
  });
});


module.exports = router;