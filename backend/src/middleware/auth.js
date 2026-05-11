// src/middleware/auth.js — Strict JWT authentication. No demo bypass.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

// ── Simple user cache (60 second TTL) to avoid DB hit on every request ──────
const userCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

function getCachedUser(id) {
  const entry = userCache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { userCache.delete(id); return null; }
  return entry.user;
}
function setCachedUser(id, user) {
  userCache.set(id, { user, ts: Date.now() });
  // Prevent unbounded growth — evict oldest if > 500 entries
  if (userCache.size > 500) {
    const firstKey = userCache.keys().next().value;
    userCache.delete(firstKey);
  }
}

exports.protect = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return next(new AppError('Not authorized. No token provided.', 401));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try cache first — avoids a DB round-trip on every request
    let user = getCachedUser(decoded.id);
    if (!user) {
      user = await User.findById(decoded.id).populate('company');
      if (user) setCachedUser(decoded.id, user);
    }

    if (!user || !user.isActive) {
      return next(new AppError('User not found or account disabled.', 401));
    }

    req.user = user;
    req.company = user.company;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return next(new AppError('Invalid token.', 401));
    if (err.name === 'TokenExpiredError') return next(new AppError('Token expired. Please log in again.', 401));
    next(err);
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

exports.checkPermission = (permission) => {
  return (req, res, next) => {
    if (req.user.role === 'admin') return next();
    
    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasAny = permissions.some(p => req.user.permissions && req.user.permissions[p]);

    if (!hasAny) {
      return next(new AppError(`Access denied. You need '${permissions.join(' or ')}' permission.`, 403));
    }
    next();
  };
};
