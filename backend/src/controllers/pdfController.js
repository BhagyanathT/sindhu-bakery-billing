// src/controllers/pdfController.js — Public PDF download (no auth required)
const path    = require('path');
const fs      = require('fs');
const PdfLink = require('../models/PdfLink');
const logger  = require('../utils/logger');

/**
 * GET /b/:shortId
 * Public endpoint — streams the PDF file if the link is valid and not expired.
 */
exports.downloadPdf = async (req, res) => {
  try {
    const { shortId } = req.params;

    const link = await PdfLink.findOne({ shortId }).lean();

    if (!link) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>🔗 Link not found</h2>
          <p>This invoice link does not exist or has been removed.</p>
        </body></html>
      `);
    }

    if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
      return res.status(410).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>⏰ Link expired</h2>
          <p>This invoice link has expired. Please request a new one.</p>
        </body></html>
      `);
    }

    if (!fs.existsSync(link.filePath)) {
      logger.warn(`PDF file missing on disk: ${link.filePath}`);
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>📄 File not found</h2>
          <p>The invoice PDF could not be located. Please contact the shop.</p>
        </body></html>
      `);
    }

    // Increment download counter (fire-and-forget)
    PdfLink.findByIdAndUpdate(link._id, { $inc: { downloads: 1 } }).catch(() => {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${link.fileName}"`);
    fs.createReadStream(link.filePath).pipe(res);
  } catch (err) {
    logger.error(`PDF download error: ${err.message}`);
    res.status(500).send('Server error — could not retrieve invoice.');
  }
};
