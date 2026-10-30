const Review = require('../models/Review');

exports.getAllReviews = async (req, res) => {
  try {
    const { status = 'approved', limit = 10, productId } = req.query;
    
    let query = { status };
    if (productId) query.product = productId;
    
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    const stats = await Review.getAverageRating();
    
    res.json({
      success: true,
      stats,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching reviews',
      message: error.message
    });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { customerName, rating, comment, productId } = req.body;
    
    const reviewData = {
      customerName,
      rating,
      comment,
      product: productId || null
    };
    
    const review = new Review(reviewData);
    await review.save();
    
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error creating review',
      message: error.message
    });
  }
};

exports.getReviewStats = async (req, res) => {
  try {
    const stats = await Review.getAverageRating();
    
    const distribution = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: { 
        _id: '$rating',
        count: { $sum: 1 }
      }},
      { $sort: { _id: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        averageRating: stats.averageRating,
        totalReviews: stats.totalReviews,
        distribution
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching review statistics',
      message: error.message
    });
  }
};

exports.updateReviewStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }
    
    res.json({
      success: true,
      message: `Review status updated to ${status}`,
      data: review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error updating review status',
      message: error.message
    });
  }
};