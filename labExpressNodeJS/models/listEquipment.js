const mongoose = require("mongoose");

const equipmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId, // FK to Category collection
    ref: 'Categories',
    required: true
  },
  description: {
    type: String,
    maxlength: 100
  },
  status: {
    type: String,
    enum: ['available', 'unavailable', 'broken'],
    default: 'available'
  },
  image: {
    type: String,
    maxlength: 255
  },
  location: {
    type: String,
    maxlength: 100
  },
  deleted_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Equipment', equipmentSchema, 'equipments');