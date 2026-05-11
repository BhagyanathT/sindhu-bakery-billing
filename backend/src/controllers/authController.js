// src/controllers/authController.js — Strict MongoDB mode. No demo bypass.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');
const AuditLog = require('../models/AuditLog');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '24h' });

const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' });

const createSendTokens = (user, statusCode, res) => {
  const accessToken = signToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  // In production (HTTPS) use secure + sameSite:none for cross-origin cookies.
  // In development (HTTP localhost) these flags cause browsers to silently
  // reject the cookie, breaking the refresh flow and causing auto-logout.
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(statusCode).json({
    success: true,
    accessToken,
    data: { user },
  });
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone, companyName } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return next(new AppError('Email already registered.', 409));

    const company = await Company.create({
      name: companyName || `${name}'s Business`,
      settings: {
        gstSlabs: [
          { rate: 0, label: 'GST 0%' },
          { rate: 5, label: 'GST 5%' },
          { rate: 12, label: 'GST 12%' },
          { rate: 18, label: 'GST 18%' },
          { rate: 28, label: 'GST 28%' },
        ],
      },
    });

    const user = await User.create({
      name, email, password, phone,
      role: 'admin',
      company: company._id,
      permissions: { billing: true, inventory: true, customers: true, accounting: true, reports: true, settings: true },
    });

    company.owner = user._id;
    await company.save();

    user.company = company;
    createSendTokens(user, 201, res);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return next(new AppError('Email and password are required.', 400));

    const user = await User.findOne({ email }).select('+password').populate('company');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password.', 401));
    }
    if (!user.isActive) return next(new AppError('Account has been disabled. Contact admin.', 403));

    // ── Session tracking ──────────────────────────────────────────────────────
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    const deviceId = crypto.createHash('md5').update(ua + ip).digest('hex');

    // Update lastSeen if same device already exists, otherwise push new session
    const existingSession = user.activeSessions.find(s => s.deviceId === deviceId);
    if (existingSession) {
      existingSession.lastSeen = new Date();
    } else {
      user.activeSessions.push({ deviceId, ip, userAgent: ua, connectedAt: new Date(), lastSeen: new Date() });
    }
    // Keep max 10 sessions
    if (user.activeSessions.length > 10) {
      user.activeSessions = user.activeSessions.slice(-10);
    }

    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save({ validateBeforeSave: false });

    createSendTokens(user, 200, res);
  } catch (err) {
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) return next(new AppError('No refresh token provided.', 401));

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).populate('company');
    if (!user || !user.isActive) return next(new AppError('Invalid refresh token.', 401));

    // Update lastSeen for the matching session
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    const deviceId = crypto.createHash('md5').update(ua + ip).digest('hex');
    const session = user.activeSessions.find(s => s.deviceId === deviceId);
    if (session) {
      session.lastSeen = new Date();
      await user.save({ validateBeforeSave: false });
    }

    const accessToken = signToken(user._id);
    res.json({ success: true, accessToken, data: { user } });
  } catch (err) {
    next(new AppError('Invalid refresh token.', 401));
  }
};

exports.logout = async (req, res, next) => {
  try {
    // Remove session entry for this device
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    const deviceId = crypto.createHash('md5').update(ua + ip).digest('hex');

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { activeSessions: { deviceId } },
    });

    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', { 
      httpOnly: true, 
      secure: isProd, 
      sameSite: isProd ? 'none' : 'lax',
    });
    AuditLog.create({
      company: req.user.company?._id,
      user: req.user._id,
      userName: req.user.name,
      action: 'LOGOUT',
      module: 'auth',
      description: `User ${req.user.name} logged out`,
    }).catch((err) => logger.warn(`AuditLog write skipped on logout: ${err.message}`));
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return next(new AppError('Current password is incorrect.', 401));
    }
    user.password = newPassword;
    await user.save();
    createSendTokens(user, 200, res);
  } catch (err) {
    next(err);
  }
};
