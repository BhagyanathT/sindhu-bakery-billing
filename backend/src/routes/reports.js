// src/routes/reports.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect, checkPermission } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// /insights is used by the dashboard — available to all authenticated users
router.get('/insights', reportController.getBusinessInsights);

// These are restricted to users with 'reports' permission
router.get('/profit-loss', checkPermission('reports'), reportController.getProfitLoss);
router.get('/gst', checkPermission('reports'), reportController.getGSTReport);
router.get('/cash-flow', checkPermission('reports'), reportController.getCashFlow);

module.exports = router;
