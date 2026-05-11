// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ['admin', 'staff', 'accountant', 'cashier'], default: 'staff' },
  avatar: { type: String },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  salaryType: { type: String, enum: ['monthly', 'weekly', 'daily'], default: 'monthly' },
  salaryAmount: { type: Number, default: 0, min: 0 },
  joinDate: { type: Date, default: Date.now },
  loginCount: { type: Number, default: 0 },
  permissions: {
    billing: { type: Boolean, default: true },
    inventory: { type: Boolean, default: true },
    customers: { type: Boolean, default: true },
    accounting: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    settings: { type: Boolean, default: false },
  },
  refreshToken: { type: String, select: false },
  activeSessions: [{
    deviceId: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    connectedAt: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
