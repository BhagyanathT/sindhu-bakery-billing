// src/models/WhatsAppTemplate.js
const mongoose = require('mongoose');

const whatsAppTemplateSchema = new mongoose.Schema({
  company:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name:     { type: String, required: true, trim: true },
  type:     { type: String, enum: ['invoice', 'promo', 'alert', 'custom', 'order_status'], default: 'custom' },
  body:     { type: String, required: true },   // Supports {{customerName}}, {{total}}, {{invoiceNo}} etc.
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('WhatsAppTemplate', whatsAppTemplateSchema);
