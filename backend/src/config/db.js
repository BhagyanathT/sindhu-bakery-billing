// src/config/db.js — Strict MongoDB-only mode. No fallback. No demo mode.
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<db_password>')) {
    logger.error('CRITICAL: MONGODB_URI is not set or still contains the placeholder <db_password>.');
    logger.error('Please update backend/.env with your real MongoDB Atlas password.');
    process.exit(1);
  }

  // Enable command buffering — operations will wait if connection drops briefly
  mongoose.set('bufferCommands', true);

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 30000, // Wait 30s instead of failing fast
      socketTimeoutMS: 60000, // Keep sockets alive longer
      family: 4 // Use IPv4, skip trying IPv6 first
    });

    logger.info(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Reconnecting natively...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected ✅');
    });

  } catch (error) {
    logger.error(`CRITICAL: Cannot connect to MongoDB Atlas — ${error.message}`);
    logger.error('Ensure your MONGODB_URI in backend/.env is correct and Atlas allows your IP.');
    process.exit(1); // Hard stop — no local fallback
  }
};

module.exports = connectDB;
