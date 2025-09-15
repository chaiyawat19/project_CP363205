var express = require("express");
var router = express.Router();
var User = require("../models/User");
var bcrypt = require("bcryptjs");

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express", name: "Seba" });
});

router.get("/login", function (req, res, next) {
  res.render("login", { title: "Login Page", layout: "layouts/auth" });
});

router.get("/register", function (req, res, next) {
  res.render("register", { title: "Register Page", layout: "layouts/auth" });
});

router.post("/register", async  (req, res, next) => {
  const { fname, lname, email, password, confirmPassword } = req.body;
  try {
    
    if (!fname || !lname || !email || !password || !confirmPassword) {
      return res.status(400).send("All fields are required");
    }
    if (password !== confirmPassword) {
      return res.status(400).send("Passwords do not match");
    }
    
    // ตรวจสอบว่ามี email นี้แล้วหรือยัง
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send("Email already registered");
    }

    // เข้ารหัสรหัสผ่านก่อนบันทึก
    const hashedPassword = await bcrypt.hash(password, 10);

     const newUser = new User({
      fname,
      lname,
      email,
      password: hashedPassword,
      userProfile: `https://avatar.iran.liara.run/username?username=${fname}+${lname}`,
      userRole: "user",
      department: ""
    });

    await newUser.save();

    res.send("User registered successfully");

  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }

});

router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).send("All fields are required");
    }
    
    const user = await User.find ({ email });
    if (!user) {
      return res.status(400).send("Invalid email or password");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send("Invalid email or password");
    }

    res.send("Login successful");

  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
