const mongoose = require("mongoose");

const borrowSchema = new mongoose.Schema({
  user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users', // FK ไปที่ collection User
      required: true
    },
    equipment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Equipment', // FK ไปที่ collection Equipment
      required: true
    },
    return_date: {
      type: Date, // date-local ใช้ Date ใน Mongoose
      required: true
    },
    actual_return_date: {
      type: Date,
      default: null
    },
    note: {
      type: String,
      maxlength: 100
    },
    status: {
      type: String,
      enum: ['waiting', 'rejected', 'borrowed', 'returned', 'late', 'lost', 'waitingForReturn'],
      default: 'waiting' 
    }
  }, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  });

module.exports = mongoose.model('Borrows', borrowSchema, 'borrows');