// src/services/automationService.js
// Centralised automation event hub for the WhatsApp system.
// All fire-and-forget WA triggers go through here.

const logger = require('../utils/logger');

// ── Lazy-load models & services to avoid circular deps ────────────────────────
const getWa        = () => require('./whatsappService');
const getWaMsg     = () => require('../models/WhatsAppMessage');
const getProduct   = () => require('../models/Product');
const getCompany   = () => require('../models/Company');

// ── Helpers ───────────────────────────────────────────────────────────────────
const logMsg = async ({ company, customer, invoiceRef, phone, messageType, body, status, provider, twilioSid, errorMessage, sentBy }) => {
  const WaMsg = getWaMsg();
  const wa    = getWa();
  return WaMsg.create({
    company, customer, invoiceRef,
    phone: wa.normalisePhone(phone) || phone,
    messageType, body, status, provider, twilioSid, errorMessage,
    sentAt: status === 'sent' ? new Date() : undefined,
    sentBy,
  }).catch(err => logger.warn(`[automation] WA log failed: ${err.message}`));
};

const getWaConfig = (company) => company?.whatsapp || {};

// ── Event: Bill Created ───────────────────────────────────────────────────────
/**
 * Triggered after every successful invoice creation.
 * Uses company.whatsapp.autoSendInvoice flag.
 * If pdfLink is provided, appends download URL to the message.
 */
const onBillCreated = async (invoice, company, userId, pdfLink = null) => {
  try {
    const waConfig = getWaConfig(company);
    if (!waConfig?.autoSendInvoice) return;

    const phone = invoice.customerPhone;
    if (!phone) return;

    const wa = getWa();
    if (!wa.isValidPhone(phone)) {
      logger.warn(`[automation] Invalid phone on invoice ${invoice.invoiceNumber}: ${phone}`);
      return;
    }

    const companyName = company?.name || 'Sindhu Bakery';
    let body = wa.buildInvoiceMessage(invoice, companyName);

    if (pdfLink) {
      body += `\n\n📄 *Download Invoice:* ${pdfLink}`;
    }

    let provider = 'deeplink';
    let twilioSid;
    let status = 'sent';
    let errorMessage;

    if (waConfig.enabled && waConfig.twilioAccountSid && waConfig.twilioAuthToken) {
      // Tier 2: Twilio
      try {
        wa.checkRateLimit(phone);
        const result = await wa.sendViaTwilio(waConfig, phone, body);
        twilioSid = result.sid;
        provider  = 'twilio';
        logger.info(`[automation] Invoice WA sent via Twilio for ${invoice.invoiceNumber}`);
      } catch (err) {
        logger.warn(`[automation] Twilio failed, trying WA Web: ${err.message}`);
        errorMessage = err.message;
        try {
          await wa.sendViaWaWeb(phone, body);
          provider = 'wa_web';
          logger.info(`[automation] Invoice WA sent via WA Web for ${invoice.invoiceNumber}`);
        } catch {
          provider = 'deeplink';
        }
      }
    } else {
      // Tier 1.5: WA Web (no Twilio configured)
      try {
        await wa.sendViaWaWeb(phone, body);
        provider = 'wa_web';
        logger.info(`[automation] Invoice WA sent via WA Web for ${invoice.invoiceNumber}`);
      } catch {
        provider = 'deeplink'; // silent fallback — no phone action possible
      }
    }

    await logMsg({
      company: company._id, invoiceRef: invoice._id,
      phone, messageType: 'invoice', body, status,
      provider, twilioSid, errorMessage, sentBy: userId,
    });
  } catch (err) {
    // Never crash the invoice creation response
    logger.error(`[automation] onBillCreated error: ${err.message}`);
  }
};

// ── Event: Order Status Changed ───────────────────────────────────────────────
/**
 * Triggered when an invoice status changes (confirmed / preparing / ready).
 */
const onOrderStatusChanged = async (invoice, newStatus, company, userId) => {
  try {
    const phone = invoice.customerPhone || invoice.customer?.phone;
    if (!phone) return;

    const wa = getWa();
    if (!wa.isValidPhone(phone)) return;

    const companyName = company?.name || 'Sindhu Bakery';
    const body = wa.buildOrderStatusMessage(invoice, newStatus, companyName);
    const waConfig = getWaConfig(company);

    let provider = 'deeplink';
    let twilioSid;
    let errorMessage;

    if (waConfig.enabled && waConfig.twilioAccountSid && waConfig.twilioAuthToken) {
      try {
        wa.checkRateLimit(phone);
        const result = await wa.sendViaTwilio(waConfig, phone, body);
        twilioSid = result.sid;
        provider  = 'twilio';
      } catch (err) {
        errorMessage = err.message;
        provider = 'deeplink';
      }
    }

    await logMsg({
      company: company._id, invoiceRef: invoice._id,
      phone, messageType: 'order_status', body, status: 'sent',
      provider, twilioSid, errorMessage, sentBy: userId,
    });

    logger.info(`[automation] Order status "${newStatus}" WA sent for ${invoice.invoiceNumber}`);
  } catch (err) {
    logger.error(`[automation] onOrderStatusChanged error: ${err.message}`);
  }
};

// ── Event: Low Stock Detected ─────────────────────────────────────────────────
/**
 * Sends a low-stock WA alert to admin.
 * Called by the background check or manually.
 */
const onLowStockDetected = async (products, company) => {
  try {
    const waConfig = getWaConfig(company);
    const adminPhone = waConfig?.adminPhone;
    if (!adminPhone) {
      logger.warn('[automation] Low stock detected but no adminPhone configured');
      return;
    }

    const wa = getWa();
    if (!wa.isValidPhone(adminPhone)) return;

    const body = wa.buildLowStockAlert(products);

    let provider = 'deeplink';
    let twilioSid;
    let errorMessage;

    if (waConfig.enabled && waConfig.twilioAccountSid && waConfig.twilioAuthToken) {
      try {
        const result = await wa.sendViaTwilio(waConfig, adminPhone, body);
        twilioSid = result.sid;
        provider  = 'twilio';
      } catch (err) {
        errorMessage = err.message;
      }
    }

    const deepLinkUrl = provider === 'deeplink' ? wa.buildDeepLinkUrl(adminPhone, body) : null;

    await logMsg({
      company: company._id, phone: adminPhone,
      messageType: 'alert', body, status: 'sent',
      provider, twilioSid, errorMessage, sentBy: null,
    });

    logger.info(`[automation] Low-stock alert sent for ${products.length} products (company: ${company.name})`);
    return deepLinkUrl;
  } catch (err) {
    logger.error(`[automation] onLowStockDetected error: ${err.message}`);
  }
};

// ── Background: Periodic Stock Check ─────────────────────────────────────────
const INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

let _bgTimer = null;

const startBackgroundChecks = () => {
  if (_bgTimer) return; // already started

  const runCheck = async () => {
    logger.info('[automation] Running periodic low-stock check…');
    try {
      const Product = getProduct();
      const Company = getCompany();

      // Group low-stock products by company
      const lowStock = await Product.aggregate([
        {
          $match: {
            isActive: true,
            $expr: { $lte: ['$stock.current', '$stock.minLevel'] },
          },
        },
        { $group: { _id: '$company', products: { $push: '$$ROOT' } } },
      ]);

      for (const group of lowStock) {
        const company = await Company.findById(group._id).lean();
        if (!company) continue;
        await onLowStockDetected(group.products, company);
      }
    } catch (err) {
      logger.error(`[automation] Background stock check error: ${err.message}`);
    }
  };

  // Run once at startup (with a 30s delay so DB is settled), then on interval
  setTimeout(runCheck, 30_000);
  _bgTimer = setInterval(runCheck, INTERVAL_MS);
  logger.info('[automation] Background stock check started (every 6h)');
};

const stopBackgroundChecks = () => {
  if (_bgTimer) { clearInterval(_bgTimer); _bgTimer = null; }
};

module.exports = {
  onBillCreated,
  onOrderStatusChanged,
  onLowStockDetected,
  startBackgroundChecks,
  stopBackgroundChecks,
};
