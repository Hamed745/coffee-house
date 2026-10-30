const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { requireAdmin } = require('../middleware/auth.middleware');

router.get('/', reviewController.getAllReviews);
router.get('/stats', reviewController.getReviewStats);
router.post('/', reviewController.createReview);
router.put('/:id/status', requireAdmin, reviewController.updateReviewStatus);

module.exports = router;
