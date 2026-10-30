const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { requireAdmin } = require('../middleware/auth.middleware');

// Public routes
router.get('/', productController.getAllProducts);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/:id', productController.getProductById);

// Admin-only routes
router.post('/', requireAdmin, productController.createProduct);
router.patch('/desserts/stock', requireAdmin, productController.updateAllDessertStock);
router.put('/:id', requireAdmin, productController.updateProduct);
router.delete('/:id', requireAdmin, productController.deleteProduct);

module.exports = router;
