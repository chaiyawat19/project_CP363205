const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
    // ชื่อแผนก (จำเป็นต้องมี, ไม่ซ้ำกัน)
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    deleted_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Export Model ออกไปเพื่อให้ไฟล์อื่นเรียกใช้งานได้
module.exports = mongoose.model('Department', DepartmentSchema);