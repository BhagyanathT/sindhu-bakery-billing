// src/models/Leave.js
const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  type: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
