// src/routes/expenses.js
const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { protect, checkPermission } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(protect, checkPermission('accounting'));
router.get('/', expenseController.getExpenses);
router.post('/', expenseController.createExpense);
router.get('/export', expenseController.exportExpenses);
router.post('/import', upload.single('file'), expenseController.importExpenses);
router.patch('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
