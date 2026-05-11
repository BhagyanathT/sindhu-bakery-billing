// src/routes/staff.js
const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);
router.use(restrictTo('admin'));

router.route('/')
  .get(staffController.getAllStaff)
  .post(staffController.createStaff);

router.route('/:id')
  .patch(staffController.updateStaff)
  .delete(staffController.deleteStaff);

// Permanent hard delete
router.delete('/:id/permanent', staffController.permanentDeleteStaff);

module.exports = router;
