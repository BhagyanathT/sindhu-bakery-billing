// src/routes/customers.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { protect, checkPermission } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(protect);
router.get('/top', customerController.getTopCustomers);
router.get('/', checkPermission(['customers', 'billing']), customerController.getCustomers);
router.post('/', checkPermission('customers'), customerController.createCustomer);
router.post('/bulk-delete', checkPermission('customers'), customerController.bulkDeleteCustomers);
router.get('/export', checkPermission(['customers', 'billing']), customerController.exportCustomers);
router.post('/import', checkPermission('customers'), upload.single('file'), customerController.importCustomers);
router.get('/:id', checkPermission(['customers', 'billing']), customerController.getCustomer);
router.patch('/:id', checkPermission('customers'), customerController.updateCustomer);
router.delete('/:id', checkPermission('customers'), customerController.deleteCustomer);
router.get('/:id/transactions', checkPermission('customers'), customerController.getCustomerTransactions);

module.exports = router;
