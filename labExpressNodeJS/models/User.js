
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fname: { 
    type: String, 
    required: true },
  lname: { 
    type: String, 
    required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true },
  password: { 
    type: String, 
    required: true },
  userProfile: { 
    type: String },
  userRole: { 
    type: String, 
    enum: ['admin', 'user'], 
    default: 'user' },
  department: { 
    type:  mongoose.Schema.Types.ObjectId,
    ref: 'Department', 
    default: null }
}, { timestamps: true });


module.exports = mongoose.model("User", userSchema,'users');
