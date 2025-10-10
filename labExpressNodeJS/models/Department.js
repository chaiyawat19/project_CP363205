const mongoose = require('mongoose');

<<<<<<< HEAD
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

module.exports = mongoose.model('Department', DepartmentSchema);
=======
const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Department', departmentSchema);

>>>>>>> a9001332d64f37c5d1ac1730fedcbc626f33ade6
