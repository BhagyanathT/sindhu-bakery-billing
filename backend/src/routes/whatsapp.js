// src/routes/whatsapp.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/whatsappController');
const waWebCtrl = require('../controllers/waWebController');
const { protect } = require('../middleware/auth');

router.use(protect);

// ── WhatsApp Web QR session ────────────────────────────────────────────────────
router.get('/web/status',          waWebCtrl.getStatus);
router.post('/web/disconnect',     waWebCtrl.disconnect);
router.post('/web/reconnect',      waWebCtrl.reconnect);

// Config
router.get('/config',         ctrl.getConfig);
router.put('/config',         ctrl.updateConfig);

// Stats & history
router.get('/stats',          ctrl.getStats);
router.get('/messages',       ctrl.getMessageHistory);
router.delete('/messages',    ctrl.clearMessageHistory);

// Send
router.get('/preview/invoice/:invoiceId',  ctrl.previewInvoice);
router.post('/send/invoice/:invoiceId',    ctrl.sendInvoice);
router.post('/send/bill/:invoiceId',       ctrl.sendBill);
router.post('/send/custom',               ctrl.sendCustom);
router.post('/send/promo',                ctrl.sendPromo);
router.post('/send/alert/lowstock',       ctrl.sendLowStockAlert);

// Templates
router.get('/templates',           ctrl.getTemplates);
router.post('/templates',          ctrl.saveTemplate);
router.delete('/templates/:id',    ctrl.deleteTemplate);

module.exports = router;
