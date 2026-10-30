const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  customerName: { 
    type: String, 
    required: [true, 'Customer name is required'] 
  },
  rating: { 
    type: Number, 
    required: true,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: { 
    type: String, 
    required: [true, 'Comment is required'],
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  verifiedPurchase: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

reviewSchema.statics.getAverageRating = async function() {
  const result = await this.aggregate([
    { $match: { status: 'approved' } },
    { $group: { 
      _id: null, 
      averageRating: { $avg: '$rating' },
      totalReviews: { $sum: 1 }
    }}
  ]);
  
  return result.length > 0 ? result[0] : { averageRating: 0, totalReviews: 0 };
};

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;