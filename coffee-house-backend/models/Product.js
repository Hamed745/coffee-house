const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    en: { type: String, required: [true, 'English name is required'] },
    ru: { type: String, required: [true, 'Russian name is required'] }
  },
  description: {
    en: { type: String, default: '' },
    ru: { type: String, default: '' }
  },
  category: { 
    type: String, 
    enum: {
      values: ['coffee', 'dessert', 'other'],
      message: 'Category must be coffee, dessert, or other'
    },
    required: [true, 'Category is required']
  },
  price: { 
    type: Number, 
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  image: { 
    type: String, 
    default: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80'
  },
  featured: { type: Boolean, default: false },
  available: { type: Boolean, default: true },
  tags: [{ type: String }],
  calories: { type: Number, default: 0 },
  preparationTime: { type: Number, default: 5 },
  // Stock count – only used for desserts. -1 = unlimited (coffee etc.)
  stock: { type: Number, default: -1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

productSchema.statics.findByCategory = function(category) {
  return this.find({ category, available: true });
};

productSchema.methods.getLocalizedName = function(lang = 'en') {
  return this.name[lang] || this.name.en;
};

productSchema.methods.getLocalizedDescription = function(lang = 'en') {
  return this.description[lang] || this.description.en;
};

const Product = mongoose.model('Product', productSchema);
module.exports = Product;