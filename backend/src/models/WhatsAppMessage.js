// src/models/WhatsAppMessage.js
const mongoose = require('mongoose');

const whatsAppMessageSchema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customer:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  invoiceRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  phone:       { type: String, required: true },
  messageType: {
    type: String,
    enum: ['invoice', 'promo', 'alert', 'custom', 'order_status'],
    default: 'custom',
  },
  body:        { type: String, required: true },
  mediaUrl:    String,
  status:      { type: String, enum: ['pending', 'sent', 'delivered', 'failed'], default: 'pending' },
  provider:    { type: String, enum: ['twilio', 'deeplink', 'meta'], default: 'deeplink' },
  twilioSid:   String,
  errorMessage: String,
  sentAt:      Date,
  deliveredAt: Date,
  sentBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

whatsAppMessageSchema.index({ company: 1, createdAt: -1 });
whatsAppMessageSchema.index({ company: 1, customer: 1 });
whatsAppMessageSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model('WhatsAppMessage', whatsAppMessageSchema);
