const express = require('express');
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth.protect);

router
  .route('/')
  .get(categoryController.getCategories)
  .post(categoryController.createCategory);

router
  .route('/:id')
  .patch(categoryController.updateCategory)
  .delete(categoryController.deleteCategory);

module.exports = router;
