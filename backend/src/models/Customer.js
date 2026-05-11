// src/models/Customer.js
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  gstin: { type: String, uppercase: true, trim: true },
  pan: String,
  customerType: { type: String, enum: ['retail', 'wholesale', 'distributor'], default: 'retail' },
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
  },
  creditLimit: { type: Number, default: 0 },
  creditBalance: { type: Number, default: 0 }, // positive = customer owes us (Udhar)
  totalPurchase: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  discount: { type: Number, default: 0 }, // default discount %
  notes: String,
  tags: [String],
  isActive: { type: Boolean, default: true },
  lastTransactionDate: Date,
  avatar: String,
}, { timestamps: true });

customerSchema.index({ company: 1, name: 'text', phone: 'text', email: 'text' });
customerSchema.virtual('outstanding').get(function () {
  return this.totalPurchase - this.totalPaid;
});

module.exports = mongoose.model('Customer', customerSchema);
