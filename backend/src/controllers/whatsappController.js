// src/controllers/whatsappController.js
const WhatsAppMessage  = require('../models/WhatsAppMessage');
const WhatsAppTemplate = require('../models/WhatsAppTemplate');
const Invoice          = require('../models/Invoice');
const Customer         = require('../models/Customer');
const Product          = require('../models/Product');
const Company          = require('../models/Company');
const PdfLink          = require('../models/PdfLink');
const AppError         = require('../utils/AppError');
const wa               = require('../services/whatsappService');
const pdfService       = require('../services/pdfService');
const logger           = require('../utils/logger');
const crypto           = require('crypto');

// ── Helpers ────────────────────────────────────────────────────────────────────
const getWaConfig = (company) => company?.whatsapp || {};

const logMessage = async ({ company, customer, invoiceRef, phone, messageType, body, status, provider, twilioSid, errorMessage, sentBy }) => {
  return WhatsAppMessage.create({
    company, customer, invoiceRef, phone: wa.normalisePhone(phone) || phone,
    messageType, body, status, provider, twilioSid, errorMessage,
    sentAt: status === 'sent' ? new Date() : undefined,
    sentBy,
  });
};

// ── Send Invoice ───────────────────────────────────────────────────────────────
exports.sendInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.invoiceId, company: req.company._id })
      .populate('customer').lean();
    if (!invoice) return next(new AppError('Invoice not found', 404));

    const phone = req.body.phone || invoice.customer?.phone || invoice.customerPhone;
    if (!phone) return next(new AppError('No phone number available for this customer', 400));
    if (!wa.isValidPhone(phone)) return next(new AppError('Invalid phone number', 400));

    const companyName = req.company?.name || 'Sindhu Bakery';
    const body = req.body.customMessage || wa.buildInvoiceMessage(invoice, companyName);

    const config = getWaConfig(req.company);
    let provider = 'deeplink';
    let twilioSid;
    let status = 'sent';
    let errorMessage;
    let deepLinkUrl;

    if (config.enabled && config.twilioAccountSid && config.twilioAuthToken) {
      // Tier 2: Twilio
      try {
        wa.checkRateLimit(phone);
        const result = await wa.sendViaTwilio(config, phone, body);
        twilioSid = result.sid;
        provider = 'twilio';
      } catch (err) {
        logger.warn(`Twilio failed, falling back to WA Web / deeplink: ${err.message}`);
        errorMessage = err.message;
        try {
          await wa.sendViaWaWeb(phone, body);
          provider = 'wa_web';
        } catch {
          provider = 'deeplink';
          deepLinkUrl = wa.buildDeepLinkUrl(phone, body);
        }
      }
    } else {
      // Tier 1.5: WA Web
      try {
        await wa.sendViaWaWeb(phone, body);
        provider = 'wa_web';
      } catch {
        // Tier 1: deeplink
        provider = 'deeplink';
        deepLinkUrl = wa.buildDeepLinkUrl(phone, body);
      }
    }

    await logMessage({
      company: req.company._id, customer: invoice.customer?._id,
      invoiceRef: invoice._id, phone, messageType: 'invoice',
      body, status, provider, twilioSid, errorMessage, sentBy: req.user._id,
    });

    res.json({ success: true, data: { provider, deepLinkUrl, phone: wa.normalisePhone(phone) } });
  } catch (err) { next(err); }
};

// ── Send Custom Message ────────────────────────────────────────────────────────
exports.sendCustom = async (req, res, next) => {
  try {
    const { phone, customerId, body, messageType = 'custom' } = req.body;
    if (!body?.trim()) return next(new AppError('Message body is required', 400));

    let targetPhone = phone;
    let customerId_ = customerId;
    let customerName;

    if (customerId) {
      const cust = await Customer.findOne({ _id: customerId, company: req.company._id }).lean();
      if (!cust) return next(new AppError('Customer not found', 404));
      targetPhone = targetPhone || cust.phone;
      customerName = cust.name;
    }

    if (!targetPhone) return next(new AppError('Phone number is required', 400));
    if (!wa.isValidPhone(targetPhone)) return next(new AppError('Invalid phone number', 400));

    const fullBody = wa.buildCustomMessage(body, customerName);
    const config = getWaConfig(req.company);
    let provider = 'deeplink';
    let twilioSid;
    let status = 'sent';
    let errorMessage;
    let deepLinkUrl;

    if (config.enabled && config.twilioAccountSid && config.twilioAuthToken) {
      try {
        wa.checkRateLimit(targetPhone);
        const result = await wa.sendViaTwilio(config, targetPhone, fullBody, req.body.mediaUrl);
        twilioSid = result.sid;
        provider = 'twilio';
      } catch (err) {
        errorMessage = err.message;
        try {
          await wa.sendViaWaWeb(targetPhone, fullBody);
          provider = 'wa_web';
        } catch {
          deepLinkUrl = wa.buildDeepLinkUrl(targetPhone, fullBody);
        }
      }
    } else {
      try {
        await wa.sendViaWaWeb(targetPhone, fullBody);
        provider = 'wa_web';
      } catch {
        deepLinkUrl = wa.buildDeepLinkUrl(targetPhone, fullBody);
      }
    }

    await logMessage({
      company: req.company._id, customer: customerId_ || undefined,
      phone: targetPhone, messageType, body: fullBody,
      status, provider, twilioSid, errorMessage, sentBy: req.user._id,
    });

    res.json({ success: true, data: { provider, deepLinkUrl, phone: wa.normalisePhone(targetPhone) } });
  } catch (err) { next(err); }
};

// ── Send Promo (broadcast to customer group / list) ───────────────────────────
exports.sendPromo = async (req, res, next) => {
  try {
    const { productId, customerIds, customMessage, mediaUrl } = req.body;

    let product;
    if (productId) {
      product = await Product.findOne({ _id: productId, company: req.company._id }).lean();
      if (!product) return next(new AppError('Product not found', 404));
    }

    // Resolve target customers
    const query = { company: req.company._id, isActive: true };
    if (customerIds?.length > 0) query._id = { $in: customerIds };
    const customers = await Customer.find(query).lean();
    const withPhone = customers.filter(c => c.phone && wa.isValidPhone(c.phone));

    if (withPhone.length === 0) return next(new AppError('No customers with valid phone numbers found', 400));

    const companyName = req.company?.name || 'Sindhu Bakery';
    const config = getWaConfig(req.company);

    const results = { sent: 0, failed: 0, deeplinks: [] };

    for (const cust of withPhone) {
      const body = customMessage || (product ? wa.buildPromoMessage(product, companyName) : '');
      if (!body) continue;

      let provider = 'deeplink';
      let twilioSid;
      let status = 'sent';
      let errorMessage;

      if (config.enabled && config.twilioAccountSid && config.twilioAuthToken) {
        try {
          wa.checkRateLimit(cust.phone);
          await new Promise(r => setTimeout(r, 1000)); // 1 msg/sec rate limit
          const result = await wa.sendViaTwilio(config, cust.phone, body, mediaUrl);
          twilioSid = result.sid;
          provider = 'twilio';
          results.sent++;
        } catch (err) {
          status = 'failed';
          errorMessage = err.message;
          results.failed++;
          results.deeplinks.push(wa.buildDeepLinkUrl(cust.phone, body));
        }
      } else {
        results.deeplinks.push(wa.buildDeepLinkUrl(cust.phone, body));
        results.sent++;
      }

      await logMessage({
        company: req.company._id, customer: cust._id, phone: cust.phone,
        messageType: 'promo', body, status, provider, twilioSid, errorMessage, sentBy: req.user._id,
      }).catch(() => {});
    }

    res.json({ success: true, data: { ...results, total: withPhone.length } });
  } catch (err) { next(err); }
};

// ── Low Stock Alert ────────────────────────────────────────────────────────────
exports.sendLowStockAlert = async (req, res, next) => {
  try {
    const config = getWaConfig(req.company);
    const adminPhone = req.body.phone || config.adminPhone;
    if (!adminPhone) return next(new AppError('Admin phone number not configured', 400));
    if (!wa.isValidPhone(adminPhone)) return next(new AppError('Invalid admin phone number', 400));

    // Find all low-stock products for this company
    const products = await Product.find({
      company: req.company._id,
      isActive: true,
      $expr: { $lte: ['$stock.current', '$stock.minLevel'] },
    }).lean();

    if (products.length === 0) {
      return res.json({ success: true, data: { message: 'No low stock products found', products: 0 } });
    }

    const body = wa.buildLowStockAlert(products);
    let provider = 'deeplink';
    let twilioSid;
    let deepLinkUrl;
    let errorMessage;

    if (config.enabled && config.twilioAccountSid && config.twilioAuthToken) {
      try {
        const result = await wa.sendViaTwilio(config, adminPhone, body);
        twilioSid = result.sid;
        provider = 'twilio';
      } catch (err) {
        deepLinkUrl = wa.buildDeepLinkUrl(adminPhone, body);
        errorMessage = err.message;
      }
    } else {
      deepLinkUrl = wa.buildDeepLinkUrl(adminPhone, body);
    }

    await logMessage({
      company: req.company._id, phone: adminPhone,
      messageType: 'alert', body, status: 'sent', provider, twilioSid, errorMessage, sentBy: req.user._id,
    });

    res.json({ success: true, data: { provider, deepLinkUrl, products: products.length } });
  } catch (err) { next(err); }
};

// ── Message History ────────────────────────────────────────────────────────────
exports.getMessageHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, customerId, messageType, status, startDate, endDate } = req.query;
    const query = { company: req.company._id };
    if (customerId)   query.customer = customerId;
    if (messageType)  query.messageType = messageType;
    if (status)       query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate)   query.createdAt.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const [messages, total] = await Promise.all([
      WhatsAppMessage.find(query)
        .populate('customer', 'name phone')
        .populate('invoiceRef', 'invoiceNumber grandTotal')
        .populate('sentBy', 'name')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      WhatsAppMessage.countDocuments(query),
    ]);

    res.json({ success: true, data: { messages, total, page: pageNum, pages: Math.ceil(total / limitNum) } });
  } catch (err) { next(err); }
};

// ── Stats ──────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const [statusCounts, typeCounts, recentMessages] = await Promise.all([
      WhatsAppMessage.aggregate([
        { $match: { company: req.company._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      WhatsAppMessage.aggregate([
        { $match: { company: req.company._id } },
        { $group: { _id: '$messageType', count: { $sum: 1 } } },
      ]),
      WhatsAppMessage.find({ company: req.company._id })
        .sort({ createdAt: -1 }).limit(5)
        .populate('customer', 'name').lean(),
    ]);

    const stats = { byStatus: {}, byType: {}, total: 0, recentMessages };
    statusCounts.forEach(s => { stats.byStatus[s._id] = s.count; stats.total += s.count; });
    typeCounts.forEach(t => { stats.byType[t._id] = t.count; });

    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
};

// ── Config ─────────────────────────────────────────────────────────────────────
exports.getConfig = async (req, res, next) => {
  try {
    const company = await Company.findById(req.company._id).select('whatsapp name').lean();
    const config = company?.whatsapp || {};
    // Mask auth token
    if (config.twilioAuthToken) {
      config.twilioAuthToken = '••••••••' + config.twilioAuthToken.slice(-4);
    }
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const allowed = ['enabled', 'provider', 'twilioAccountSid', 'twilioAuthToken', 'twilioFromNumber', 'adminPhone', 'autoSendInvoice', 'autoSendPromo'];
    const update = {};
    allowed.forEach(key => {
      if (req.body[key] !== undefined) update[`whatsapp.${key}`] = req.body[key];
    });

    // Don't overwrite auth token if it contains masked value
    if (req.body.twilioAuthToken?.includes('••••')) {
      delete update['whatsapp.twilioAuthToken'];
    }

    await Company.findByIdAndUpdate(req.company._id, { $set: update });
    res.json({ success: true, message: 'WhatsApp configuration updated' });
  } catch (err) { next(err); }
};

// ── Templates ──────────────────────────────────────────────────────────────────
exports.getTemplates = async (req, res, next) => {
  try {
    const templates = await WhatsAppTemplate.find({ company: req.company._id, isActive: true }).lean();
    res.json({ success: true, data: templates });
  } catch (err) { next(err); }
};

exports.saveTemplate = async (req, res, next) => {
  try {
    const { _id, name, type, body } = req.body;
    if (!name?.trim() || !body?.trim()) return next(new AppError('Name and body are required', 400));
    let template;
    if (_id) {
      template = await WhatsAppTemplate.findOneAndUpdate(
        { _id, company: req.company._id },
        { name, type, body },
        { new: true },
      );
    } else {
      template = await WhatsAppTemplate.create({ company: req.company._id, name, type, body });
    }
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    await WhatsAppTemplate.findOneAndDelete({ _id: req.params.id, company: req.company._id });
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) { next(err); }
};

// ── Build preview message (no send) ───────────────────────────────────────────
exports.previewInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.invoiceId, company: req.company._id }).lean();
    if (!invoice) return next(new AppError('Invoice not found', 404));
    const companyName = req.company?.name || 'Sindhu Bakery';
    const body = wa.buildInvoiceMessage(invoice, companyName);
    const phone = invoice.customerPhone || '';
    const deepLinkUrl = phone && wa.isValidPhone(phone) ? wa.buildDeepLinkUrl(phone, body) : null;
    res.json({ success: true, data: { body, deepLinkUrl, phone } });
  } catch (err) { next(err); }
};

// ── Send Bill (text or PDF) ────────────────────────────────────────────────────
/**
 * POST /api/whatsapp/send/bill/:invoiceId
 * Body: { sendPdf: boolean, phone?: string }
 *
 * Generates a professional invoice message (and optionally a PDF with short link)
 * then returns a wa.me deeplink for the frontend to open.
 */
exports.sendBill = async (req, res, next) => {
  try {
    const { sendPdf = false, phone: overridePhone } = req.body;

    // Fetch invoice + company
    const [invoice, company] = await Promise.all([
      Invoice.findOne({ _id: req.params.invoiceId, company: req.company._id })
        .populate('customer', 'name phone').lean(),
      Company.findById(req.company._id).lean(),
    ]);
    if (!invoice) return next(new AppError('Invoice not found', 404));

    const phone = overridePhone || invoice.customerPhone || invoice.customer?.phone;
    if (!phone) return next(new AppError('No phone number for this customer', 400));
    if (!wa.isValidPhone(phone)) return next(new AppError('Invalid phone number', 400));

    const companyName = company?.name || 'Sindhu Bakery';
    let body = wa.buildInvoiceMessage(invoice, companyName);
    let pdfShortUrl = null;
    let pdfLinkDoc  = null;

    // ── Generate PDF if requested ─────────────────────────────────────────────
    if (sendPdf) {
      try {
        // Check if a PDF link already exists for this invoice
        const existing = await PdfLink.findOne({
          invoice: invoice._id,
          company: req.company._id,
          expiresAt: { $gt: new Date() },
        }).lean();

        if (existing) {
          pdfLinkDoc  = existing;
        } else {
          const shortId  = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
          const filePath = await pdfService.generateInvoicePdf(invoice, company, shortId);
          pdfLinkDoc = await PdfLink.create({
            shortId,
            invoice:  invoice._id,
            company:  req.company._id,
            filePath,
            fileName: `${invoice.invoiceNumber || shortId}.pdf`,
          });
        }

        const baseUrl  = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
        pdfShortUrl    = `${baseUrl}/b/${pdfLinkDoc.shortId}`;
        body += `\n\n📄 *Download Invoice:* ${pdfShortUrl}`;
      } catch (pdfErr) {
        logger.error(`sendBill PDF error: ${pdfErr.message}`);
        // Graceful degradation — continue with text-only message
      }
    }

    const deepLinkUrl = wa.buildDeepLinkUrl(phone, body);

    // Log the message
    await logMessage({
      company:    req.company._id,
      customer:   invoice.customer?._id,
      invoiceRef: invoice._id,
      phone,
      messageType: 'invoice',
      body,
      status:   'sent',
      provider: 'deeplink',
      sentBy:   req.user._id,
    });

    res.json({
      success: true,
      data: {
        deepLinkUrl,
        phone: wa.normalisePhone(phone),
        sendPdf,
        pdfShortUrl,
        pdfShortId: pdfLinkDoc?.shortId || null,
        messageBody: body,
      },
    });
  } catch (err) { next(err); }
};

// ── Clear Message History ──────────────────────────────────────────────────────
exports.clearMessageHistory = async (req, res, next) => {
  try {
    // Only admins can clear history
    if (req.user.role !== 'admin') {
      return next(new AppError('Only admins can clear message history.', 403));
    }

    const { status, messageType } = req.query;
    const query = { company: req.company._id };
    
    if (status) query.status = status;
    if (messageType) query.messageType = messageType;

    const result = await WhatsAppMessage.deleteMany(query);
    
    logger.info(`[whatsapp] History cleared for company ${req.company._id} (${result.deletedCount} messages)`);
    
    res.json({ 
      success: true, 
      message: 'Message history cleared successfully',
      deletedCount: result.deletedCount 
    });
  } catch (err) { next(err); }
};
