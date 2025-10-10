const mongoose = require("mongoose");

const RepairRequestSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    equipment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      required: true,
    },
    location: { type: String }, // เพิ่มตรงนี้
    issue_description: { type: String, maxlength: 100 },
    admin_comment: { type: String },
    completion_date: { type: Date },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

module.exports = mongoose.model("RepairRequest", RepairRequestSchema, "repair_requests");
