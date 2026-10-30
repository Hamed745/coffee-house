const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { requireAdmin } = require('../middleware/auth.middleware');

router.post('/', orderController.createOrder);
router.get('/number/:orderNumber', orderController.getOrderByNumber);
router.get('/:id', orderController.getOrderById);
router.get('/', requireAdmin, orderController.getAllOrders);
router.put('/:id/status', requireAdmin, orderController.updateOrderStatus);

module.exports = router;
