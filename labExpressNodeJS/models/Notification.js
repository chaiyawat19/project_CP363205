
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Equipment", required: true }, 
  type: { type: String, enum: ['approve', 'return', 'reject', 'add']},
  message: { type: String, required: true },
  reason: { type: String },
  isRead: { type: Boolean, default: false },
  link: { type: String },
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // FK ไปที่ collection User (แอดมิน)
  admin_profile: { type: String }, // URL รูปโปรไฟล์แอดมิน
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", NotificationSchema);


