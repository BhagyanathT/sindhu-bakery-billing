// src/routes/salary.js
const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/', salaryController.getSalaries);
router.get('/pending', salaryController.getPendingSalarySummary);
router.get('/export', salaryController.exportSalaryCsv);
router.post('/generate', salaryController.generateSalary);
router.patch('/:id', salaryController.updateSalary);
router.delete('/:id', salaryController.deleteSalary);

module.exports = router;
