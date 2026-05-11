// index.js - Server entry point
require('dotenv').config();
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  const io = new SocketIOServer(server, {
    cors: {
      origin: FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    logger.info(`[socket.io] Client connected: ${socket.id}`);
    // Immediately push current WA Web status to the newly connected client
    try {
      const waWeb = require('./src/services/waWebService');
      socket.emit('wa:status', waWeb.getStatus());
    } catch {}

    socket.on('disconnect', () => {
      logger.info(`[socket.io] Client disconnected: ${socket.id}`);
    });
  });

  // ── WhatsApp Web session (Tier 1.5) ───────────────────────────────────────
  try {
    const waWeb = require('./src/services/waWebService');
    waWeb.init(io);
    logger.info('[waWeb] WhatsApp Web service initialised');
  } catch (err) {
    logger.warn(`[waWeb] Could not initialise WA Web (package missing?): ${err.message}`);
  }

  // ── Start background automation (low-stock checks every 6h) ───────────────
  try {
    const automationService = require('./src/services/automationService');
    automationService.startBackgroundChecks();
  } catch (err) {
    logger.warn(`Could not start automation background checks: ${err.message}`);
  }

  // Graceful shutdown on SIGTERM
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    try {
      const waWeb = require('./src/services/waWebService');
      await waWeb.disconnect();
    } catch {}
    const automation = require('./src/services/automationService');
    automation.stopBackgroundChecks();
    server.close(() => {
      logger.info('Process terminated.');
      process.exit(0);
    });
  });

  // Log unhandled promise rejections but DO NOT kill the server
  process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message || err}`);
  });

  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`);
    process.exit(1);
  });

  const HOST = process.env.HOST || '0.0.0.0';

  server.listen(PORT, HOST, () => {
    logger.info(`🚀 Sindhu Bakery Billing System running on http://${HOST}:${PORT} in ${process.env.NODE_ENV} mode`);
    logger.info(`📊 API: http://${HOST}:${PORT}/api`);
    logger.info(`❤️  Health: http://${HOST}:${PORT}/health`);
    logger.info(`🔌 Socket.IO: ws://${HOST}:${PORT}`);
  });
};

startServer(); // Triggering restart

