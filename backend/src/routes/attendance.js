// src/routes/attendance.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);

// Staff routes (any authenticated user)
router.post('/checkin', attendanceController.checkIn);
router.post('/checkout', attendanceController.checkOut);
router.get('/me/today', attendanceController.getMyTodayAttendance);

// Admin-only routes
router.use(restrictTo('admin'));
router.get('/', attendanceController.getAllAttendance);
router.get('/summary', attendanceController.getMonthlyAttendanceSummary);
router.get('/export', attendanceController.exportAttendanceCsv);
router.post('/mark', attendanceController.markAttendance);
router.patch('/:id', attendanceController.updateAttendance);
router.delete('/:id', attendanceController.deleteAttendance);

module.exports = router;
