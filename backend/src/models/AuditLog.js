// src/models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  action: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PRINT', 'VIEW'],
    required: true,
  },
  module: {
    type: String,
    enum: ['auth', 'invoice', 'product', 'customer', 'expense', 'report', 'user', 'company', 'payment'],
    required: true,
  },
  document: { type: mongoose.Schema.Types.ObjectId },
  description: String,
  previousData: mongoose.Schema.Types.Mixed,
  newData: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
}, { timestamps: true });

auditLogSchema.index({ company: 1, createdAt: -1 });
module.exports = mongoose.model('AuditLog', auditLogSchema);
