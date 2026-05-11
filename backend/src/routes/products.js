// src/routes/products.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);

// Excel import — must come before /:id to avoid conflicts
router.post(
  '/import',
  checkPermission('inventory'),
  productController.xlsxUpload.single('file'),
  productController.importProducts
);

router.get('/stats', checkPermission(['inventory', 'billing']), productController.getInventoryStats);
router.get('/low-stock', checkPermission(['inventory', 'billing']), productController.getLowStockAlerts);
router.get('/', checkPermission(['inventory', 'billing']), productController.getProducts);
router.post('/', checkPermission('inventory'), productController.createProduct);

// ⚠️ Static routes MUST come before /:id to avoid being swallowed
router.delete('/wipe-all', checkPermission('inventory'), productController.wipeAllProducts);
router.delete('/', checkPermission('inventory'), productController.bulkDeleteProducts);

router.get('/:id', checkPermission(['inventory', 'billing']), productController.getProduct);
router.patch('/:id', checkPermission('inventory'), productController.updateProduct);
router.delete('/:id', checkPermission('inventory'), productController.deleteProduct);
router.post('/:id/adjust-stock', checkPermission('inventory'), productController.adjustStock);

module.exports = router;

