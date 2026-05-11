// src/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true },
  sku: { type: String, trim: true, index: true },
  barcode: { type: String, trim: true, index: true },
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  unit: { type: String, default: 'pcs', enum: ['pcs', 'kg', 'g', 'l', 'ml', 'box', 'm', 'cm', 'dozen', 'dozens', 'pair'] },
  images: [String],
  sellingPrice: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, min: 0, default: 0 },
  mrp: { type: Number, min: 0, default: 0 },
  discount: { type: Number, min: 0, max: 100, default: 0 },
  tax: {
    hsn: String,
    gstRate: { type: Number, default: 18, enum: [0, 5, 12, 18, 28] },
    cessRate: { type: Number, default: 0 },
    taxType: { type: String, enum: ['inclusive', 'exclusive'], default: 'exclusive' },
  },
  stock: {
    current: { type: Number, default: 0 },
    minLevel: { type: Number, default: 5 },
    maxLevel: { type: Number, default: 1000 },
    openingStock: { type: Number, default: 0 },
  },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  batch: {
    enabled: { type: Boolean, default: false },
    batches: [{
      batchNumber: String,
      expiryDate: Date,
      quantity: Number,
      manufacturingDate: Date,
    }],
  },
  isActive: { type: Boolean, default: true },
  tags: [String],
  salesCount: { type: Number, default: 0 },
  emoji: { type: String, default: '🛍️' },
}, { timestamps: true });

productSchema.index({ company: 1, name: 'text', sku: 'text', barcode: 'text' });
productSchema.virtual('profitMargin').get(function () {
  if (this.costPrice === 0) return 100;
  return ((this.sellingPrice - this.costPrice) / this.sellingPrice * 100).toFixed(2);
});

module.exports = mongoose.model('Product', productSchema);
