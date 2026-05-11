// src/controllers/staffController.js
const User = require('../models/User');
const AppError = require('../utils/AppError');

// Get all staff for a company
exports.getAllStaff = async (req, res, next) => {
  try {
    const staff = await User.find({ company: req.company._id, role: { $ne: 'admin' } })
      .select('-password -refreshToken')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { staff } });
  } catch (err) {
    next(err);
  }
};

// Create a new staff member (Admin only)
exports.createStaff = async (req, res, next) => {
  try {
    let { name, email, password, phone, role, salaryType, salaryAmount, joinDate, isActive, permissions } = req.body;

    if (!name) return next(new AppError('Name is required.', 400));
    if (!email) return next(new AppError('Email is required for staff login.', 400));
    if (!password || password.length < 6) return next(new AppError('Password must be at least 6 characters.', 400));

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) return next(new AppError('This email is already registered.', 409));

    const staff = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: role || 'staff',
      company: req.company._id,
      salaryType: salaryType || 'monthly',
      salaryAmount: salaryAmount || 0,
      joinDate: joinDate || new Date(),
      isActive: isActive !== undefined ? isActive : true,
      permissions: permissions || {
        billing: true,
        inventory: true,
        customers: true,
        accounting: false,
        reports: false,
        settings: false
      }
    });

    const staffData = staff.toObject();
    delete staffData.password;

    res.status(201).json({ success: true, data: { staff: staffData } });
  } catch (err) {
    next(err);
  }
};

// Update a staff member
exports.updateStaff = async (req, res, next) => {
  try {
    const updateData = { ...req.body };

    // If password is being updated, hash it
    if (updateData.password) {
      if (updateData.password.length < 6) {
        return next(new AppError('Password must be at least 6 characters.', 400));
      }
      const bcrypt = require('bcryptjs');
      updateData.password = await bcrypt.hash(updateData.password, 12);
    } else {
      delete updateData.password;
    }

    const staff = await User.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      updateData,
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!staff) return next(new AppError('Staff member not found', 404));

    res.json({ success: true, data: { staff } });
  } catch (err) {
    next(err);
  }
};

// Deactivate a staff member (soft delete)
exports.deleteStaff = async (req, res, next) => {
  try {
    const staff = await User.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      { isActive: false },
      { new: true }
    );

    if (!staff) return next(new AppError('Staff member not found', 404));

    res.json({ success: true, message: 'Staff deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

// Permanently delete a staff member
exports.permanentDeleteStaff = async (req, res, next) => {
  try {
    const staff = await User.findOne({ _id: req.params.id, company: req.company._id });
    if (!staff) return next(new AppError('Staff member not found', 404));
    if (staff.role === 'admin') return next(new AppError('Cannot delete admin accounts.', 403));

    await User.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: `"${staff.name}" permanently deleted.` });
  } catch (err) {
    next(err);
  }
};
