// src/models/Attendance.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  date: { type: Date, required: true }, // Normalized to midnight
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  totalHours: { type: Number, default: 0 },
  status: { type: String, enum: ['Present', 'Half', 'Absent'], default: 'Absent' },
  overtimeHours: { type: Number, default: 0 }
}, { timestamps: true });

attendanceSchema.index({ company: 1, staffId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
