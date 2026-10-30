const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: [1, 'Quantity must be at least 1'],
    default: 1 
  },
  priceAtTime: { 
    type: Number, 
    required: true 
  },
  specialInstructions: { type: String, default: '' }
});

const orderSchema = new mongoose.Schema({
  orderNumber: { 
    type: String, 
    unique: true
  },
  items: [orderItemSchema],
  totalAmount: { 
    type: Number, 
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  customer: {
    name: { type: String, required: [true, 'Customer name is required'] },
    phone: { type: String, required: [true, 'Customer phone is required'] },
    email: { type: String, default: '' }
  },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending'
  },
  orderType: {
    type: String,
    enum: ['pickup', 'delivery'],
    default: 'pickup'
  },
  deliveryAddress: {
    street: String,
    city: String,
    apartment: String
  },
  deliveryNotes: String,
  pickupTime: Date,
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `ORD-${timestamp}-${random}`;
  }
  this.updatedAt = Date.now();
  next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;