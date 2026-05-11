// src/controllers/waWebController.js
// REST endpoints for WhatsApp Web session management.
// QR streaming happens over Socket.IO (not REST), these are just control endpoints.

const waWebService = require('../services/waWebService');
const logger = require('../utils/logger');

// GET /api/whatsapp/web/status
exports.getStatus = async (req, res, next) => {
  try {
    const status = waWebService.getStatus();
    res.json({ success: true, data: status });
  } catch (err) { next(err); }
};

// POST /api/whatsapp/web/disconnect
exports.disconnect = async (req, res, next) => {
  try {
    await waWebService.disconnect();
    logger.info(`[waWebCtrl] Session disconnected by user ${req.user?.email}`);
    res.json({ success: true, message: 'WhatsApp Web session disconnected' });
  } catch (err) { next(err); }
};

// POST /api/whatsapp/web/reconnect
exports.reconnect = async (req, res, next) => {
  try {
    waWebService.reconnect();
    logger.info(`[waWebCtrl] Reconnect triggered by user ${req.user?.email}`);
    res.json({ success: true, message: 'WhatsApp Web reconnecting — scan the QR code' });
  } catch (err) { next(err); }
};
