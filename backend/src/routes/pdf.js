// src/routes/pdf.js — Public PDF download route (no auth)
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/pdfController');

// GET /b/:shortId — public, no auth middleware
router.get('/:shortId', ctrl.downloadPdf);

module.exports = router;
