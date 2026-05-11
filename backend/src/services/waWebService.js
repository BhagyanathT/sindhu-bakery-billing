// src/services/waWebService.js
// Tier 1.5: WhatsApp Web QR session (unofficial, scan-once, persistent)
// Uses whatsapp-web.js + LocalAuth so the session survives server restarts.
// Socket.IO streams the QR code and status events to the frontend in real-time.

const logger = require('../utils/logger');

// ── Module state ──────────────────────────────────────────────────────────────
let _client = null;
let _io     = null;   // Socket.IO server instance

// Possible values: 'idle' | 'loading' | 'qr' | 'authenticated' | 'connected' | 'disconnected' | 'not_installed'
let _status = 'idle';
let _qrData = null;         // base64 PNG of the current QR code
let _connectedPhone = null; // phone number once connected
let _notInstalled = false;  // true if whatsapp-web.js is missing

// ── Initialise (called from index.js after Socket.IO is ready) ────────────────
const init = (io) => {
  if (_client) {
    logger.warn('[waWeb] Already initialised — skipping duplicate init');
    return;
  }

  _io = io;

  try {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const qrcode = require('qrcode');

    logger.info('[waWeb] Initialising WhatsApp Web client…');
    _setStatus('loading');

    _client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'sindhu-bakery',
        dataPath: '.wwebjs_auth',
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      },
    });

    // ── QR received — convert to base64 PNG and broadcast ────────────────────
    _client.on('qr', async (qr) => {
      try {
        _qrData = await qrcode.toDataURL(qr, { width: 300, margin: 2 });
        _setStatus('qr');
        logger.info('[waWeb] QR code generated — waiting for scan');
      } catch (err) {
        logger.error(`[waWeb] QR generation error: ${err.message}`);
      }
    });

    // ── Authenticated (session restored or freshly scanned) ───────────────────
    _client.on('authenticated', () => {
      _qrData = null;
      _setStatus('authenticated');
      logger.info('[waWeb] Authenticated successfully');
    });

    // ── Auth failure ──────────────────────────────────────────────────────────
    _client.on('auth_failure', (msg) => {
      logger.error(`[waWeb] Auth failure: ${msg}`);
      _setStatus('disconnected');
    });

    // ── Ready — fully connected, can send messages ────────────────────────────
    _client.on('ready', async () => {
      try {
        const info = _client.info;
        _connectedPhone = info?.wid?.user ? `+${info.wid.user}` : null;
        _setStatus('connected');
        logger.info(`[waWeb] Connected — phone: ${_connectedPhone}`);
      } catch {
        _setStatus('connected');
      }
    });

    // ── Disconnected ──────────────────────────────────────────────────────────
    _client.on('disconnected', (reason) => {
      logger.warn(`[waWeb] Disconnected: ${reason}`);
      _connectedPhone = null;
      _setStatus('disconnected');
      // Nullify client so reconnect() creates a fresh one
      _client = null;
    });

    _client.initialize().catch((err) => {
      logger.error(`[waWeb] Client initialise error: ${err.message}`);
      _setStatus('disconnected');
      _client = null;
    });

  } catch (err) {
    const isModuleError = err.code === 'MODULE_NOT_FOUND' && err.message.includes('whatsapp-web.js');
    if (isModuleError) {
      logger.error('[waWeb] Package not installed. Run: npm install whatsapp-web.js qrcode');
      _notInstalled = true;
      _status = 'not_installed';
      if (_io) _io.emit('wa:status', { status: 'not_installed', phone: null, qr: null });
    } else {
      logger.error(`[waWeb] Init error: ${err.message}`);
      _setStatus('disconnected');
    }
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const _setStatus = (status) => {
  _status = status;
  if (_io) {
    _io.emit('wa:status', { status, phone: _connectedPhone, qr: _qrData });
  }
};

const getStatus = () => ({
  status: _status,
  phone: _connectedPhone,
  qr: _qrData,
  notInstalled: _notInstalled,
});

// ── Send a WhatsApp message via the connected session ─────────────────────────
/**
 * @param {string} phone  — E.164 format e.g. "+919876543210"
 * @param {string} text   — message body
 */
const sendMessage = async (phone, text) => {
  if (_status !== 'connected' || !_client) {
    throw new Error('WhatsApp Web session is not connected');
  }

  // whatsapp-web.js uses "919876543210@c.us" format (no +)
  const chatId = phone.replace(/^\+/, '') + '@c.us';
  const msg = await _client.sendMessage(chatId, text);
  logger.info(`[waWeb] Message sent to ${phone} — id: ${msg?.id?.id}`);
  return msg;
};

// ── Disconnect session (logout) ───────────────────────────────────────────────
const disconnect = async () => {
  if (!_client) {
    _setStatus('disconnected');
    return;
  }
  try {
    await _client.logout();
  } catch {}
  try {
    await _client.destroy();
  } catch {}
  _client = null;
  _connectedPhone = null;
  _setStatus('disconnected');
  logger.info('[waWeb] Session logged out');
};

// ── Reconnect — destroy old client and create fresh one (new QR) ─────────────
const reconnect = (io) => {
  if (_client) {
    try { _client.destroy().catch(() => {}); } catch {}
    _client = null;
  }
  _connectedPhone = null;
  _qrData = null;
  init(io || _io);
};

// ── Is connected? ─────────────────────────────────────────────────────────────
const isConnected = () => _status === 'connected';
const isNotInstalled = () => _notInstalled;

module.exports = { init, getStatus, sendMessage, disconnect, reconnect, isConnected, isNotInstalled };
