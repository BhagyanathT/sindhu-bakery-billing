// src/models/Salary.js
const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  month: { type: String, required: true }, // e.g., '2026-05'
  totalWorkingDays: { type: Number, default: 30 },
  presentDays: { type: Number, default: 0 },
  halfDays: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  baseSalary: { type: Number, required: true },
  finalSalary: { type: Number, required: true },
  advances: { type: Number, default: 0 },
  status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
  paidDate: { type: Date }
}, { timestamps: true });

salarySchema.index({ company: 1, staffId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Salary', salarySchema);
