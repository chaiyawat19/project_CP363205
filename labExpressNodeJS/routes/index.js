var express = require("express");
var router = express.Router();
var bcrypt = require("bcryptjs");

// ========================================
// 📦 Import Models
// ========================================
const User = require("../models/User");
const Equipment = require('../models/listEquipment');
const Borrow = require('../models/Borrow');

// ========================================
// 🏠 หน้าแรก (Landing Page)
// ========================================

/**
 * GET / - แสดงหน้าแรกพร้อมสถิติระบบ
 * ถ้า Login แล้ว redirect ไปหน้าที่เหมาะสมตาม role
 */
router.get("/", async function (req, res, next) {
    try {
        // ตรวจสอบ session ก่อน
        if (req.session && req.session.userId) {
            if (req.session.userRole === 'admin') {
                return res.redirect('/admin/listitemuser');
            } else if (req.session.userRole === 'user') {
                return res.redirect('/users');
            }
        }

        // นับจำนวนข้อมูลทั้งหมดแบบ parallel
        const [userCount, equipmentCount, borrowCount] = await Promise.all([
            User.countDocuments({}), 
            Equipment.countDocuments({}), 
            Borrow.countDocuments({}) 
        ]);

        res.render("index", { 
            title: "AssetFlow",
            userCount: userCount,
            equipmentCount: equipmentCount,
            borrowCount: borrowCount
        });
    } catch (error) {
        console.error("Error loading homepage:", error);
        res.status(500).render("error", {
            title: "เกิดข้อผิดพลาด",
            message: "ไม่สามารถโหลดข้อมูลได้"
        });
    }
});

// ========================================
// 🔐 การเข้าสู่ระบบ (Login)
// ========================================

/**
 * GET /login - แสดงหน้า Login
 * ถ้า Login แล้ว redirect ไปหน้าที่เหมาะสม
 */
router.get("/login", function (req, res, next) {
    if (req.session && req.session.userId) {
        if (req.session.userRole === 'admin') {
            return res.redirect('/admin/listitemuser');
        } else if (req.session.userRole === 'user') {
            return res.redirect('/users');
        }
    }
    res.render("login", { 
        title: "เข้าสู่ระบบ", 
        layout: "layouts/auth" 
    });
});

/**
 * POST /login - ตรวจสอบข้อมูลและเข้าสู่ระบบ
 */
router.post("/login", async (req, res, next) => {
    const { email, password } = req.body;
    const generalError = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"; 
    
    try {
        // ตรวจสอบว่ากรอกข้อมูลครบหรือไม่
        if (!email || !password) {
            return res.render("login", { 
                title: "เข้าสู่ระบบ", 
                layout: "layouts/auth", 
                error: "กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน"
            });
        }
        
        // ค้นหาผู้ใช้จาก email
        const user = await User.findOne({ email });
        if (!user) {
            return res.render("login", { 
                title: "เข้าสู่ระบบ", 
                layout: "layouts/auth", 
                error: generalError 
            });
        }

        // ตรวจสอบรหัสผ่าน
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render("login", { 
                title: "เข้าสู่ระบบ", 
                layout: "layouts/auth", 
                error: generalError 
            });
        }

        // สร้าง Session เก็บข้อมูลผู้ใช้
        req.session.userId = user._id;
        req.session.userRole = user.userRole;
        req.session.userProfile = user.userProfile;
        req.session.userName = user.fname;
        req.session.userEmail = user.email;
        
        // ส่ง URL สำหรับ redirect กลับไปที่ client
        const redirectUrl = user.userRole === 'admin' ? '/admin/listitemuser' : '/users';
        return res.render("login", { 
            title: "เข้าสู่ระบบ", 
            layout: "layouts/auth",
            success: redirectUrl
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

// ========================================
// 📝 การสมัครสมาชิก (Register)
// ========================================

/**
 * GET /register - แสดงหน้าสมัครสมาชิก
 * ถ้า Login แล้ว redirect ไปหน้าที่เหมาะสม
 */
router.get("/register", function (req, res, next) {
    if (req.session && req.session.userId) {
        if (req.session.userRole === 'admin') {
            return res.redirect('/admin/listitemuser');
        } else if (req.session.userRole === 'user') {
            return res.redirect('/users');
        }
    }
    res.render("register", { 
        title: "สมัครสมาชิก", 
        layout: "layouts/auth" 
    });
});

/**
 * POST /register - บันทึกข้อมูลสมาชิกใหม่
 */
router.post("/register", async (req, res, next) => {
    const { fname, lname, email, password, confirmPassword } = req.body;
    
    try {
        // ตรวจสอบข้อมูลให้ครบถ้วน
        if (!fname || !lname || !email || !password || !confirmPassword) {
            return res.render("register", { 
                title: "สมัครสมาชิก", 
                layout: "layouts/auth", 
                error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" 
            });
        }

        // ตรวจสอบรหัสผ่านตรงกันหรือไม่
        if (password !== confirmPassword) {
            return res.render("register", { 
                title: "สมัครสมาชิก", 
                layout: "layouts/auth", 
                error: "รหัสผ่านไม่ตรงกัน" 
            });
        }

        // ตรวจสอบว่า email ซ้ำหรือไม่
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render("register", { 
                title: "สมัครสมาชิก", 
                layout: "layouts/auth", 
                error: "อีเมลนี้ถูกใช้งานแล้ว" 
            });
        }

        // เข้ารหัสรหัสผ่าน
        const hashedPassword = await bcrypt.hash(password, 10);

        // สร้างผู้ใช้ใหม่
        const newUser = new User({
            fname,
            lname,
            email,
            password: hashedPassword,
            userProfile: `https://ui-avatars.com/api/?name=${encodeURIComponent(fname)}+${encodeURIComponent(lname)}`,
            userRole: "user"
        });

        await newUser.save();
        
        return res.render("register", { 
            title: "สมัครสมาชิก", 
            layout: "layouts/auth", 
            success: "สมัครสมาชิกเรียบร้อยแล้ว สามารถเข้าสู่ระบบได้" 
        });

    } catch (error) {
        console.error("Register Error:", error);
        return res.render("register", { 
            title: "สมัครสมาชิก", 
            layout: "layouts/auth", 
            error: "เกิดข้อผิดพลาดของระบบ" 
        });
    }
});

// ========================================
// 🚪 ออกจากระบบ (Logout)
// ========================================

/**
 * POST /logout - ออกจากระบบ (API)
 */
router.post("/logout", (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ 
                error: "ไม่สามารถออกจากระบบได้" 
            });
        }
        res.json({ 
            success: true, 
            message: "ออกจากระบบเรียบร้อยแล้ว" 
        });
    });
});

/**
 * GET /logout - ออกจากระบบ (Redirect)
 */
router.get("/logout", (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout Error:", err);
            return res.redirect('/');
        }
        res.redirect('/');
    });
});

// ========================================
// 🔀 Route Redirect (สำหรับความเข้ากันได้เก่า)
// ========================================

/**
 * GET /listitemuser - Redirect ตาม role
 * @deprecated ใช้สำหรับความเข้ากันได้เก่า
 */
router.get("/listitemuser", function (req, res, next) {
    if (req.session.userRole === 'admin') {
        return res.redirect('/admin/listitemuser');
    } else if (req.session.userRole === 'user') {
        return res.redirect('/users/listitemuser');
    }
    return res.redirect('/login');
});

// ========================================
// 📤 Export Router
// ========================================

module.exports = router;