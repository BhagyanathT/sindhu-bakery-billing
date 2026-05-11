// src/models/Invoice.js
const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  sku: String,
  hsn: String,
  quantity: { type: Number, required: true, min: 0.01 },
  unit: { type: String, default: 'pcs' },
  rate: { type: Number, required: true, min: 0 },
  mrp: { type: Number, default: 0 },          // Max Retail Price for display on receipts
  discount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  taxRate: { type: Number, default: 0 },
  taxType: { type: String, enum: ['inclusive', 'exclusive'], default: 'exclusive' },
  amount: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  method: { type: String, enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'credit', 'other'], required: true },
  amount: { type: Number, required: true },
  reference: String,
  date: { type: Date, default: Date.now },
  note: String,
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  invoiceNumber: { type: String, required: true, index: true },
  type: { type: String, enum: ['sale', 'purchase', 'sale_return', 'purchase_return', 'quotation', 'delivery_challan'], default: 'sale' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: String,
  customerPhone: String,
  customerGstin: String,
  date: { type: Date, default: Date.now },
  dueDate: Date,
  items: [invoiceItemSchema],
  subtotal: { type: Number, default: 0 },
  totalDiscount: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  cgstTotal: { type: Number, default: 0 },
  sgstTotal: { type: Number, default: 0 },
  igstTotal: { type: Number, default: 0 },
  roundOff: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  payments: [paymentSchema],
  totalPaid: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  shippingAddress: {
    line1: String, line2: String, city: String, state: String, pincode: String,
  },
  isInterState: { type: Boolean, default: false },
  notes: String,
  terms: String,
  billingMode: { type: String, enum: ['full', 'quick'], default: 'full' },
  quickNote: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['draft', 'confirmed', 'dispatched', 'delivered', 'cancelled'], default: 'confirmed' },
  pdfUrl: String,
}, { timestamps: true });

invoiceSchema.index({ company: 1, date: -1 });
invoiceSchema.index({ company: 1, customer: 1 });
invoiceSchema.index({ company: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
