// src/services/whatsappService.js
// Tier-1:   wa.me deep-link URLs (zero config, works immediately)
// Tier-1.5: WhatsApp Web QR session (scan-once, auto-send via waWebService)
// Tier-2:   Twilio WhatsApp API (programmatic, requires credentials)

const logger = require('../utils/logger');

// ── Phone normalisation ────────────────────────────────────────────────────────
const normalisePhone = (raw) => {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
};

const isValidPhone = (phone) => {
  if (!phone) return false;
  const normalised = normalisePhone(phone);
  return /^\+\d{7,15}$/.test(normalised);
};

// ── Message builders ───────────────────────────────────────────────────────────
const buildInvoiceMessage = (invoice, companyName = 'Sindhu Bakery') => {
  const date = new Date(invoice.date || invoice.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const itemLines = (invoice.items || [])
    .slice(0, 8)
    .map((item) => `  • ${item.name} × ${item.quantity || item.qty} — ₹${(item.amount || item.total || 0).toFixed(2)}`)
    .join('\n');
  const more = invoice.items?.length > 8 ? `\n  ...and ${invoice.items.length - 8} more item(s)` : '';
  return (
`🧾 *Invoice from ${companyName}*
──────────────────────
📋 Invoice No: *${invoice.invoiceNumber || invoice._id}*
👤 Customer: *${invoice.customerName || 'Valued Customer'}*
📅 Date: ${date}

🛍️ *Items Ordered:*
${itemLines}${more}
──────────────────────
💰 Subtotal:  ₹${(invoice.subtotal || 0).toFixed(2)}
${invoice.totalTax > 0 ? `🧾 GST:       ₹${(invoice.totalTax || 0).toFixed(2)}\n` : ''}${invoice.totalDiscount > 0 ? `🎁 Discount: -₹${(invoice.totalDiscount || 0).toFixed(2)}\n` : ''}✅ *TOTAL:     ₹${(invoice.grandTotal || 0).toFixed(2)}*
──────────────────────
💳 Payment: ${(invoice.payments?.[0]?.method || 'Cash').toUpperCase()}
Status: ${invoice.paymentStatus === 'paid' ? '✅ Paid' : invoice.paymentStatus === 'partial' ? '⚠️ Partially Paid' : '❌ Unpaid'}

Thank you for shopping with us! 🙏
*${companyName}*`
  );
};

const buildPromoMessage = (product, companyName = 'Sindhu Bakery') => {
  return (
`🎉 *New Arrival at ${companyName}!*
──────────────────────
${product.emoji || '🛍️'} *${product.name}*
📂 Category: ${product.category || 'General'}
💰 Price: *₹${product.sellingPrice}*
${product.unit ? `📦 Unit: ${product.unit}` : ''}
${product.description ? `\n📝 ${product.description}` : ''}
──────────────────────
Order now or visit us in store! 🏪`
  );
};

const buildLowStockAlert = (products) => {
  const lines = products
    .slice(0, 10)
    .map((p) => `  • ${p.emoji || '📦'} ${p.name}: *${p.stock?.current ?? 0}* ${p.unit || 'units'} left (min: ${p.stock?.minLevel ?? 5})`)
    .join('\n');
  return (
`⚠️ *Low Stock Alert — Sindhu Bakery*
──────────────────────
The following products are running low:

${lines}
${products.length > 10 ? `\n...and ${products.length - 10} more item(s)` : ''}
──────────────────────
Please restock at the earliest. 🏪`
  );
};

const buildCustomMessage = (body, customerName) => {
  if (!customerName) return body;
  return `Hi *${customerName}*,\n\n${body}\n\n— Sindhu Bakery 🍞`;
};

const buildOrderStatusMessage = (invoice, status, companyName = 'Sindhu Bakery') => {
  const statusMap = {
    confirmed: '✅ Your order has been *confirmed*!',
    preparing: '👩‍🍳 Your order is being *prepared*.',
    ready:     '🎉 Your order is *ready* for pickup!',
    shipped:   '🚚 Your order has been *shipped*!',
    delivered: '✅ Your order has been *delivered*. Enjoy!',
    cancelled: '❌ Your order has been *cancelled*.',
  };
  return (
`📦 *Order Update — ${companyName}*
──────────────────────
Invoice: *${invoice.invoiceNumber}*
${statusMap[status] || `Status: ${status}`}

Thank you for choosing ${companyName}! 🙏`
  );
};

// ── Tier 1: deep-link URL builder ─────────────────────────────────────────────
const buildDeepLinkUrl = (phone, message) => {
  const normalised = normalisePhone(phone);
  if (!normalised) throw new Error('Invalid phone number');
  const digits = normalised.replace('+', '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

// ── Tier 1.5: WhatsApp Web QR session ─────────────────────────────────────────
const sendViaWaWeb = async (phone, body) => {
  const waWeb = require('./waWebService');
  if (!waWeb.isConnected()) throw new Error('WhatsApp Web session not connected');
  const normalised = normalisePhone(phone);
  await waWeb.sendMessage(normalised, body);
  logger.info(`[wa] Sent via WA Web to ${normalised}`);
  return true;
};

// ── Tier 2: Twilio sender ──────────────────────────────────────────────────────
const getTwilioClient = (accountSid, authToken) => {
  if (!accountSid || !authToken) throw new Error('Twilio credentials not configured');
  const twilio = require('twilio');
  return twilio(accountSid, authToken);
};

const sendViaTwilio = async (config, to, body, mediaUrl) => {
  const client = getTwilioClient(config.twilioAccountSid, config.twilioAuthToken);
  const fromNumber = `whatsapp:${config.twilioFromNumber}`;
  const toNumber = `whatsapp:${normalisePhone(to)}`;
  const params = { from: fromNumber, to: toNumber, body };
  if (mediaUrl) params.mediaUrl = [mediaUrl];
  const message = await client.messages.create(params);
  logger.info(`WhatsApp sent via Twilio: SID=${message.sid} to=${to}`);
  return { sid: message.sid, status: message.status };
};

// ── In-memory rate limiter (1 msg/s per phone) ────────────────────────────────
const _lastSent = new Map();
const checkRateLimit = (phone) => {
  const now = Date.now();
  const last = _lastSent.get(phone) || 0;
  if (now - last < 1000) throw new Error('Rate limit: please wait before sending to the same number again');
  _lastSent.set(phone, now);
};

module.exports = {
  normalisePhone,
  isValidPhone,
  buildInvoiceMessage,
  buildPromoMessage,
  buildLowStockAlert,
  buildCustomMessage,
  buildOrderStatusMessage,
  buildDeepLinkUrl,
  sendViaWaWeb,
  sendViaTwilio,
  checkRateLimit,
};
