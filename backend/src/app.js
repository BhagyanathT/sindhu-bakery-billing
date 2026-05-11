// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// Security middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
// In development, skip rate limiting for localhost to avoid false blocks during testing.
const isDev = process.env.NODE_ENV !== 'production';

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 5000, // high limit for POS usage
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDev && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', limiter);

// Auth-specific rate limit — relaxed for dev, stricter for prod
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  skip: (req) => isDev && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging
app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    success: connected,
    status: connected ? 'OK' : 'DATABASE_DISCONNECTED',
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// ── DB Status (for frontend connection indicator) ─────────────────────────────
app.get('/api/db-status', (req, res) => {
  const readyState = mongoose.connection.readyState;
  const connected = readyState === 1;
  const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.status(connected ? 200 : 503).json({
    success: true,
    connected,
    state: stateMap[readyState] || 'unknown',
    host: connected ? mongoose.connection.host : null,
    timestamp: new Date().toISOString(),
  });
});

// ── Serve static files ────────────────────────────────────────────────────────
app.use('/uploads', express.static(require('path').join(__dirname, '../public/uploads')));
app.use('/pdfs',    express.static(require('path').join(__dirname, '../public/pdfs')));

// ── Public PDF short-links (/b/:shortId) — NO auth ───────────────────────────
app.use('/b', require('./routes/pdf'));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/salary', require('./routes/salary'));
app.use('/api/leave', require('./routes/leave'));
app.use('/api/admin', require('./routes/admin'));

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` }));

// Global error handler
app.use(errorHandler);

module.exports = app;
