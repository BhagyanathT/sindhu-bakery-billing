// src/models/Company.js
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  logo: { type: String },
  tagline: { type: String },
  gstin: { type: String, uppercase: true, trim: true },
  pan: { type: String, uppercase: true },
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
  },
  phone: [String],
  email: String,
  website: String,
  bankDetails: [{
    bankName: String,
    accountName: String,
    accountNumber: String,
    ifscCode: String,
    branch: String,
    upiId: String,
  }],
  settings: {
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    financialYearStart: { type: String, default: 'April' },
    invoicePrefix: { type: String, default: 'INV' },
    invoiceStartNumber: { type: Number, default: 1 },
    currentInvoiceNumber: { type: Number, default: 1 },
    quotationPrefix: { type: String, default: 'QUO' },
    taxEnabled: { type: Boolean, default: true },
    gstSlabs: [{ rate: Number, label: String }],
    defaultTaxRate: { type: Number, default: 18 },
    termsAndConditions: String,
    invoiceNote: String,
  },
  plan: { type: String, enum: ['free', 'starter', 'pro', 'enterprise'], default: 'free' },
  planExpiry: Date,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  whatsapp: {
    enabled:            { type: Boolean, default: false },
    provider:           { type: String, enum: ['twilio', 'meta'], default: 'twilio' },
    twilioAccountSid:   String,
    twilioAuthToken:    String,
    twilioFromNumber:   String,   // e.g. +14155238886 (Twilio sandbox)
    adminPhone:         String,   // receives low-stock alerts
    autoSendInvoice:    { type: Boolean, default: false },
    autoSendPromo:      { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
