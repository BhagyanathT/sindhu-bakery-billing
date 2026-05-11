// src/routes/leave.js
const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);

// Staff routes
router.post('/', leaveController.applyLeave);
router.get('/me', leaveController.getMyLeaves);

// Admin routes
router.use(restrictTo('admin'));
router.get('/all', leaveController.getAllLeaves);
router.get('/export', leaveController.exportLeavesCsv);
router.post('/admin-add', leaveController.adminAddLeave);
router.patch('/:id/status', leaveController.updateLeaveStatus);
router.delete('/:id', leaveController.deleteLeave);

module.exports = router;
