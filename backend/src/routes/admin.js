// src/routes/admin.js — Admin-only data management + User management operations
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

router.use(protect);
router.use(restrictTo('admin'));

const Customer  = require('../models/Customer');
const Invoice   = require('../models/Invoice');
const Attendance = require('../models/Attendance');
const Leave     = require('../models/Leave');
const Salary    = require('../models/Salary');
const Product   = require('../models/Product');
const Expense   = require('../models/Expense');
const User      = require('../models/User');
const AppError  = require('../utils/AppError');

// =============================================================================
// USER MANAGEMENT ROUTES
// =============================================================================

// List all users in the company
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find({ company: req.company._id })
      .select('-password -refreshToken')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { users } });
  } catch (err) { next(err); }
});

// Get all active sessions across company users
router.get('/users/sessions', async (req, res, next) => {
  try {
    const users = await User.find({ company: req.company._id })
      .select('name email role isActive lastLogin loginCount activeSessions');

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const sessions = [];
    users.forEach(u => {
      (u.activeSessions || []).forEach(s => {
        sessions.push({
          userId: u._id,
          userName: u.name,
          userEmail: u.email,
          userRole: u.role,
          deviceId: s.deviceId,
          ip: s.ip,
          userAgent: s.userAgent,
          connectedAt: s.connectedAt,
          lastSeen: s.lastSeen,
          isOnline: s.lastSeen >= thirtyMinAgo,
        });
      });
    });

    const onlineCount = sessions.filter(s => s.isOnline).length;
    res.json({ success: true, data: { sessions, onlineCount, totalUsers: users.length } });
  } catch (err) { next(err); }
});

// Export all staff users as JSON (for Excel download in frontend)
router.get('/users/export', async (req, res, next) => {
  try {
    const users = await User.find({ company: req.company._id })
      .select('-password -refreshToken -activeSessions')
      .sort({ createdAt: -1 });

    const exportData = users.map(u => ({
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone || '',
      isActive: u.isActive,
      lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-IN') : '',
      loginCount: u.loginCount || 0,
      createdAt: new Date(u.createdAt).toLocaleDateString('en-IN'),
    }));

    res.json({ success: true, data: { users: exportData, total: exportData.length } });
  } catch (err) { next(err); }
});

// Bulk import staff users from Excel/JSON
router.post('/users/import', async (req, res, next) => {
  try {
    const { users: rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return next(new AppError('No user data provided.', 400));

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const row of rows) {
      try {
        if (!row.name || !row.email || !row.password) {
          skipped++;
          errors.push('Skipped: ' + (row.email || 'unknown') + ' — missing name/email/password');
          continue;
        }
        const exists = await User.findOne({ email: row.email.toLowerCase().trim() });
        if (exists) {
          skipped++;
          errors.push('Skipped: ' + row.email + ' — already registered');
          continue;
        }
        const safeRole = row.role === 'admin' ? 'staff' : (row.role || 'staff');
        await User.create({
          name: row.name.trim(),
          email: row.email.toLowerCase().trim(),
          password: row.password,
          phone: row.phone || '',
          role: safeRole,
          company: req.company._id,
          isActive: row.isActive !== false && row.isActive !== 'false',
        });
        imported++;
      } catch (e) {
        skipped++;
        errors.push('Error: ' + (row.email || 'unknown') + ' — ' + e.message);
      }
    }

    res.json({ success: true, data: { imported, skipped, total: rows.length, errors } });
  } catch (err) { next(err); }
});

// Create a new staff user
router.post('/users', async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password) return next(new AppError('Name, email, and password are required.', 400));

    const existing = await User.findOne({ email });
    if (existing) return next(new AppError('Email already registered.', 409));

    const safeRole = role === 'admin' ? 'staff' : (role || 'staff');
    const user = await User.create({
      name, email, password, phone,
      role: safeRole,
      company: req.company._id,
      permissions: {
        billing: true, inventory: true, customers: false,
        accounting: false, reports: false, settings: false,
      },
    });

    res.status(201).json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

// Update user (name, phone, role, isActive, password)
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { name, phone, role, isActive, password } = req.body;
    const user = await User.findOne({ _id: req.params.id, company: req.company._id });
    if (!user) return next(new AppError('User not found.', 404));

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined && req.user._id.toString() !== user._id.toString()) {
      user.role = role;
    }
    if (isActive !== undefined && req.user._id.toString() !== user._id.toString()) {
      user.isActive = isActive;
    }
    if (password) user.password = password;

    await user.save();
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

// Force logout / kill all sessions for a user
router.delete('/users/:id/sessions', async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, company: req.company._id });
    if (!user) return next(new AppError('User not found.', 404));
    user.activeSessions = [];
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'All sessions cleared for ' + user.name });
  } catch (err) { next(err); }
});

// Delete a staff user permanently
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString())
      return next(new AppError('You cannot delete your own account.', 400));
    const user = await User.findOne({ _id: req.params.id, company: req.company._id });
    if (!user) return next(new AppError('User not found.', 404));
    if (user.role === 'admin') return next(new AppError('Cannot delete admin accounts.', 403));
    await User.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'User "' + user.name + '" deleted permanently.' });
  } catch (err) { next(err); }
});

// =============================================================================
// DATA WIPE ROUTES
// =============================================================================

router.delete('/wipe/customers', async (req, res, next) => {
  try {
    const result = await Customer.deleteMany({ company: req.company._id });
    await Invoice.updateMany({ company: req.company._id }, { $unset: { customer: 1 } });
    res.json({ success: true, message: 'Deleted ' + result.deletedCount + ' customers' });
  } catch (err) { next(err); }
});

router.delete('/wipe/orders', async (req, res, next) => {
  try {
    const result = await Invoice.deleteMany({ company: req.company._id });
    await Product.updateMany({ company: req.company._id }, { $set: { salesCount: 0 } });
    res.json({ success: true, message: 'Deleted ' + result.deletedCount + ' orders' });
  } catch (err) { next(err); }
});

router.delete('/wipe/attendance', async (req, res, next) => {
  try {
    const result = await Attendance.deleteMany({ company: req.company._id });
    res.json({ success: true, message: 'Deleted ' + result.deletedCount + ' attendance records' });
  } catch (err) { next(err); }
});

router.delete('/wipe/leaves', async (req, res, next) => {
  try {
    const result = await Leave.deleteMany({ company: req.company._id });
    res.json({ success: true, message: 'Deleted ' + result.deletedCount + ' leave records' });
  } catch (err) { next(err); }
});

router.delete('/wipe/salaries', async (req, res, next) => {
  try {
    const result = await Salary.deleteMany({ company: req.company._id });
    res.json({ success: true, message: 'Deleted ' + result.deletedCount + ' salary records' });
  } catch (err) { next(err); }
});

router.delete('/wipe/expenses', async (req, res, next) => {
  try {
    const result = await Expense.deleteMany({ company: req.company._id });
    res.json({ success: true, message: 'Deleted ' + result.deletedCount + ' expenses' });
  } catch (err) { next(err); }
});

router.delete('/wipe/all', async (req, res, next) => {
  try {
    const [c, o, a, l, s, e] = await Promise.all([
      Customer.deleteMany({ company: req.company._id }),
      Invoice.deleteMany({ company: req.company._id }),
      Attendance.deleteMany({ company: req.company._id }),
      Leave.deleteMany({ company: req.company._id }),
      Salary.deleteMany({ company: req.company._id }),
      Expense.deleteMany({ company: req.company._id }),
    ]);
    await Product.updateMany({ company: req.company._id }, { $set: { salesCount: 0 } });
    res.json({
      success: true,
      message: 'Full wipe done: ' + c.deletedCount + ' customers, ' + o.deletedCount + ' orders, ' +
        a.deletedCount + ' attendance, ' + l.deletedCount + ' leaves, ' + s.deletedCount + ' salaries, ' +
        e.deletedCount + ' expenses',
    });
  } catch (err) { next(err); }
});

module.exports = router;
