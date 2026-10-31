
const mongoose = require('mongoose');
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  passwordSalt: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

adminSchema.methods.setPassword = async function(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Password must be at least 12 characters long');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);

  this.passwordSalt = salt;
  this.passwordHash = derivedKey.toString('hex');
};

adminSchema.methods.checkPassword = async function(password) {
  if (typeof password !== 'string') {
    return false;
  }

  // Verify old passwords and upgrade them after successful login.
  if (!this.passwordSalt) {
    const legacyHash = crypto
      .createHash('sha256')
      .update(`${password  }coffee-house-salt-2025`)
      .digest('hex');

    const storedHash = Buffer.from(this.passwordHash, 'hex');
    const candidateHash = Buffer.from(legacyHash, 'hex');

    if (
      storedHash.length !== candidateHash.length ||
      !crypto.timingSafeEqual(storedHash, candidateHash)
    ) {
      return false;
    }

    await this.setPassword(password);
    await this.save();

    return true;
  }

  try {
    const derivedKey = await scrypt(
      password,
      this.passwordSalt,
      64
    );

    const storedHash = Buffer.from(this.passwordHash, 'hex');

    return (
      storedHash.length === derivedKey.length &&
      crypto.timingSafeEqual(storedHash, derivedKey)
    );
  } catch (error) {
    return false;
  }
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
