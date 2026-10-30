const mongoose = require('mongoose');
const crypto = require('crypto');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

// Simple password hashing using crypto (no bcrypt dependency needed)
adminSchema.methods.setPassword = function(password) {
  this.passwordHash = crypto
    .createHash('sha256')
    .update(password + 'coffee-house-salt-2025')
    .digest('hex');
};

adminSchema.methods.checkPassword = function(password) {
  const hash = crypto
    .createHash('sha256')
    .update(password + 'coffee-house-salt-2025')
    .digest('hex');
  return hash === this.passwordHash;
};

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
