// src/models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true, trim: true },
  description: String,
  color: { type: String, default: '#6366f1' },
  icon: String,
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

categorySchema.index({ company: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('Category', categorySchema);
