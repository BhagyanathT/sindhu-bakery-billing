// src/models/Expense.js
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: {
    type: String,
    enum: ['rent', 'salary', 'utilities', 'marketing', 'travel', 'office', 'equipment', 'maintenance', 'taxes', 'other'],
    default: 'other',
  },
  date: { type: Date, default: Date.now },
  paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'], default: 'cash' },
  reference: String,
  notes: String,
  attachments: [String],
  tax: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isRecurring: { type: Boolean, default: false },
  recurringInterval: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
}, { timestamps: true });

expenseSchema.index({ company: 1, date: -1 });
module.exports = mongoose.model('Expense', expenseSchema);
