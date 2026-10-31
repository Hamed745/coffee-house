
const crypto = require('crypto');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { sendAdminRecoveryCode } = require('../services/email.service');

// Production must use a private, strong secret from environment variables.
const TOKEN_SECRET =
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.NODE_ENV === 'production' ? null : 'development-only-coffee-house-secret');

if (!TOKEN_SECRET || (process.env.NODE_ENV === 'production' && TOKEN_SECRET.length < 32)) {
  throw new Error('AUTH_TOKEN_SECRET must be configured with at least 32 characters in production.');
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

const ADMIN_RECOVERY_EMAIL = normalizeEmail(process.env.ADMIN_RECOVERY_EMAIL);
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || '').trim();

if (process.env.NODE_ENV === 'production') {
  if (!ADMIN_RECOVERY_EMAIL || !ADMIN_USERNAME) {
    throw new Error('ADMIN_RECOVERY_EMAIL and ADMIN_USERNAME must be configured in production.');
  }
}

// Temporary recovery storage.
// These sessions are cleared if the server restarts.
const passwordResetCodes = new Map();
const passwordResetSessions = new Map();

function cleanupPasswordResetStore() {
  const now = Date.now();

  passwordResetCodes.forEach((value, key) => {
    if (value.expiresAt <= now) {
      passwordResetCodes.delete(key);
    }
  });

  passwordResetSessions.forEach((value, key) => {
    if (value.expiresAt <= now) {
      passwordResetSessions.delete(key);
    }
  });
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload) {
  return crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
}

function generateToken(session) {
  const payload = toBase64Url(JSON.stringify(session));
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

function safeErrorResponse(res, error, message = 'An internal server error occurred.') {
  console.error(error);
  return res.status(500).json({
    success: false,
    error: message
  });
}

// ─────────────────────────────────────────────────────────────
// User Login
// NOTE: Username-only login is not secure authentication.
// It must be replaced with password-based or verified authentication
// before allowing public accounts to access private user data.
// ─────────────────────────────────────────────────────────────

exports.userLogin = async (req, res) => {
  try {
    const username =
      typeof req.body.username === 'string'
        ? req.body.username.trim()
        : '';

    if (username.length < 3 || username.length > 40) {
      return res.status(400).json({
        success: false,
        error: 'Username must be between 3 and 40 characters.'
      });
    }

    let user = await User.findOne({ username });

    if (!user) {
      user = new User({ username });
      await user.save();
    }

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    const token = generateToken({
      type: 'user',
      id: user._id.toString(),
      username: user.username,
      expiresAt
    });

    return res.json({
      success: true,
      token,
      username: user.username,
      role: 'user'
    });
  } catch (error) {
    return safeErrorResponse(res, error);
  }
};

// ─────────────────────────────────────────────────────────────
// Admin Login
// ─────────────────────────────────────────────────────────────

exports.adminLogin = async (req, res) => {
  try {
    const username =
      typeof req.body.username === 'string'
        ? req.body.username.trim()
        : '';

    const password =
      typeof req.body.password === 'string'
        ? req.body.password
        : '';

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.'
      });
    }

    const admin = await Admin.findOne({ username });

    if (!admin || !(await admin.checkPassword(password))) {
      return res.status(401).json({
        success: false,
        error: 'Wrong username or password.'
      });
    }

    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;

    const token = generateToken({
      type: 'admin',
      id: admin._id.toString(),
      username: admin.username,
      expiresAt
    });

    return res.json({
      success: true,
      token,
      username: admin.username,
      role: 'admin'
    });
  } catch (error) {
    return safeErrorResponse(res, error);
  }
};

// ─────────────────────────────────────────────────────────────
// Admin Password Recovery - Send Code
// ─────────────────────────────────────────────────────────────

async function handleAdminRecoverySendCode(req, res, { realEmailOnly }) {
  cleanupPasswordResetStore();

  const shouldUseRealEmail =
    realEmailOnly || process.env.NODE_ENV === 'production';

  const email = normalizeEmail(req.body.email);

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required.'
    });
  }

  if (!ADMIN_RECOVERY_EMAIL || email !== ADMIN_RECOVERY_EMAIL) {
    return res.status(400).json({
      success: false,
      error: 'This email is not authorized for admin recovery.'
    });
  }

  const code = String(crypto.randomInt(100000, 1000000));

  passwordResetCodes.set(email, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0
  });

  let sendResult;

  try {
    sendResult = await sendAdminRecoveryCode({
      to: email,
      code,
      realEmailOnly: shouldUseRealEmail
    });
  } catch (error) {
    passwordResetCodes.delete(email);
    console.error('Admin recovery email failed:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Could not send the recovery email. Please try again later.'
    });
  }

  if (shouldUseRealEmail) {
    if (!sendResult?.sent || sendResult.transport !== 'smtp') {
      passwordResetCodes.delete(email);

      return res.status(503).json({
        success: false,
        error: 'Email delivery is unavailable. Please check the SMTP configuration.'
      });
    }

    return res.json({
      success: true,
      delivery: 'smtp',
      message: 'A verification code has been sent to your recovery email.'
    });
  }

  if (!sendResult?.sent) {
    passwordResetCodes.delete(email);

    return res.status(503).json({
      success: false,
      error: 'Recovery email delivery is unavailable.'
    });
  }

  return res.json({
    success: true,
    message: 'A verification code has been sent.',
    delivery: sendResult.transport || 'none',
    devInboxUrl: sendResult.transport === 'ethereal'
      ? sendResult.previewUrl
      : undefined
  });
}

// Development recovery endpoint.
exports.adminRequestPasswordReset = async (req, res) => {
  try {
    await handleAdminRecoverySendCode(req, res, {
      realEmailOnly: process.env.NODE_ENV === 'production'
    });
  } catch (error) {
    return safeErrorResponse(res, error);
  }
};

// Real email recovery endpoint.
exports.adminSendRecoveryCodeRealEmail = async (req, res) => {
  try {
    await handleAdminRecoverySendCode(req, res, {
      realEmailOnly: true
    });
  } catch (error) {
    return safeErrorResponse(res, error);
  }
};

// ─────────────────────────────────────────────────────────────
// Verify Recovery Code
// ─────────────────────────────────────────────────────────────

exports.adminVerifyPasswordResetCode = async (req, res) => {
  try {
    cleanupPasswordResetStore();

    const email = normalizeEmail(req.body.email);

    const code =
      typeof req.body.code === 'string'
        ? req.body.code.trim()
        : '';

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and code are required.'
      });
    }

    if (email !== ADMIN_RECOVERY_EMAIL) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email or verification code.'
      });
    }

    const recovery = passwordResetCodes.get(email);

    if (!recovery || recovery.expiresAt <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: 'Code expired or not requested. Request a new code.'
      });
    }

    if (recovery.attempts >= 5) {
      passwordResetCodes.delete(email);

      return res.status(429).json({
        success: false,
        error: 'Too many attempts. Request a new code.'
      });
    }

    if (code !== recovery.code) {
      recovery.attempts += 1;

      return res.status(400).json({
        success: false,
        error: 'Invalid email or verification code.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    passwordResetSessions.set(resetToken, {
      email,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    passwordResetCodes.delete(email);

    return res.json({
      success: true,
      resetToken,
      message: 'Code verified. Set your new password.'
    });
  } catch (error) {
    return safeErrorResponse(res, error);
  }
};

// ─────────────────────────────────────────────────────────────
// Complete Password Reset
// ─────────────────────────────────────────────────────────────

exports.adminCompletePasswordReset = async (req, res) => {
  try {
    cleanupPasswordResetStore();

    const resetToken =
      typeof req.body.resetToken === 'string'
        ? req.body.resetToken
        : '';

    const newPassword =
      typeof req.body.newPassword === 'string'
        ? req.body.newPassword
        : '';

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Reset token and new password are required.'
      });
    }

    if (newPassword.length < 12) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 12 characters.'
      });
    }

    const session = passwordResetSessions.get(resetToken);

    if (!session || session.expiresAt <= Date.now()) {
      passwordResetSessions.delete(resetToken);

      return res.status(400).json({
        success: false,
        error: 'Reset session expired. Start again.'
      });
    }

    if (session.email !== ADMIN_RECOVERY_EMAIL) {
      passwordResetSessions.delete(resetToken);

      return res.status(400).json({
        success: false,
        error: 'Invalid reset session.'
      });
    }

    const admin = ADMIN_USERNAME
      ? await Admin.findOne({ username: ADMIN_USERNAME })
      : await Admin.findOne();

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin account not found.'
      });
    }

    await admin.setPassword(newPassword);
    await admin.save();

    passwordResetSessions.delete(resetToken);

    return res.json({
      success: true,
      message: 'Password updated. You can log in now.'
    });
  } catch (error) {
    return safeErrorResponse(res, error);
  }
};

// ─────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────

exports.logout = (req, res) => res.json({
  success: true,
  message: 'Logged out.'
});

// ─────────────────────────────────────────────────────────────
// Verify Token
// ─────────────────────────────────────────────────────────────

exports.verifyToken = (token) => {
  if (typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');

  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;

  if (!payload || !signature) {
    return null;
  }

  try {
    const expectedSignature = signPayload(payload);

    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return null;
    }

    const session = JSON.parse(fromBase64Url(payload));

    if (
      !session ||
      typeof session !== 'object' ||
      !['admin', 'user'].includes(session.type) ||
      typeof session.id !== 'string' ||
      !Number.isFinite(session.expiresAt) ||
      Date.now() >= session.expiresAt
    ) {
      return null;
    }

    return session;
  } catch (error) {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// Create Initial Admin
// ─────────────────────────────────────────────────────────────

exports.seedDefaultAdmin = async () => {
  const desiredUsername =
    typeof process.env.ADMIN_USERNAME === 'string'
      ? process.env.ADMIN_USERNAME.trim()
      : '';

  const desiredPassword =
    typeof process.env.ADMIN_INITIAL_PASSWORD === 'string'
      ? process.env.ADMIN_INITIAL_PASSWORD
      : '';

  if (!desiredUsername || !desiredPassword) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Admin bootstrap credentials are required.');
    }

    console.log('Admin bootstrap skipped: credentials not configured.');
    return;
  }

  if (desiredPassword.length < 12) {
    throw new Error('ADMIN_INITIAL_PASSWORD must be at least 12 characters.');
  }

  const existingAdmin = await Admin.findOne({
    username: desiredUsername
  });

  if (existingAdmin) {
    console.log('Admin account already exists.');
    return;
  }

  const admin = new Admin({
    username: desiredUsername
  });

  await admin.setPassword(desiredPassword);
  await admin.save();

  console.log('Initial admin account created successfully.');
};
