const express = require('express');

const router = express.Router();
const orderController = require('../controllers/order.controller');
const { requireAdmin } = require('../middleware/auth.middleware');
const orderTrackingLimiter = require('../middleware/orderTrackingLimiter');

router.post('/', orderController.createOrder);
router.post('/track', orderTrackingLimiter, orderController.trackOrder);
router.get('/', requireAdmin, orderController.getAllOrders);
router.put('/:id/status', requireAdmin, orderController.updateOrderStatus);

module.exports = router;
