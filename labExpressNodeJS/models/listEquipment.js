const mongoose = require("mongoose");

const equipmentSchema = new mongoose.Schema({
  equipment_id: Number,
  name: String,
  category_id: Number,
  description: String,
  status: String,
  image: String,
  location: String,
  created_at: Date,
  updated_at: Date,
  deleted_at: Date
});

module.exports = mongoose.model('Equipment', equipmentSchema, 'equipments');