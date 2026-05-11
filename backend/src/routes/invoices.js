// src/routes/invoices.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { protect, checkPermission, restrictTo } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard-stats', invoiceController.getDashboardStats);
router.get('/sales-chart', invoiceController.getSalesChart);
router.get('/period-stats', checkPermission('billing'), invoiceController.getPeriodStats);
router.post('/bulk-import', restrictTo('admin'), invoiceController.bulkImport);
router.get('/', checkPermission('billing'), invoiceController.getInvoices);
router.post('/', checkPermission('billing'), invoiceController.createInvoice);
router.post('/quick', checkPermission('billing'), invoiceController.createQuickInvoice);
router.get('/:id', checkPermission('billing'), invoiceController.getInvoice);
router.get('/:id/pdf', checkPermission('billing'), invoiceController.generatePdf);
router.put('/:id', checkPermission('billing'), invoiceController.updateInvoice);
router.delete('/:id', restrictTo('admin'), invoiceController.deleteInvoice);
router.post('/:id/payment', checkPermission('billing'), invoiceController.addPayment);

module.exports = router;

