// src/models/PdfLink.js — Short-URL model for PDF invoice download links
const mongoose = require('mongoose');

const pdfLinkSchema = new mongoose.Schema({
  shortId:   { type: String, required: true, unique: true, index: true },
  invoice:   { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  company:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  filePath:  { type: String, required: true },           // absolute path on disk
  fileName:  { type: String, required: true },           // e.g. INV-00001.pdf
  expiresAt: { type: Date,   default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days
  downloads: { type: Number, default: 0 },
}, { timestamps: true });

pdfLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
pdfLinkSchema.index({ company: 1, invoice: 1 });

module.exports = mongoose.model('PdfLink', pdfLinkSchema);
