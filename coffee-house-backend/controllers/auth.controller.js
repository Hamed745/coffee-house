const User = require('../models/User');
const Admin = require('../models/Admin');
const crypto = require('crypto');
const { sendAdminRecoveryCode } = require('../services/email.service');

const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'coffee-house-auth-secret';

// Admin password recovery (in-memory codes; email via SMTP if SMTP_USER + SMTP_PASS set)
const ADMIN_RECOVERY_EMAIL = (process.env.ADMIN_RECOVERY_EMAIL || 'ha6456278@gmail.com').toLowerCase();
const passwordResetCodes = new Map(); // email -> { code, expiresAt, attempts }
const passwordResetSessions = new Map(); // token -> { email, expiresAt }

function normalizeEmail(e) {
  return (e || '').trim().toLowerCase();
}

function cleanupPasswordResetStore() {
  const now = Date.now();
  passwordResetCodes.forEach((v, k) => {
    if (v.expiresAt < now) passwordResetCodes.delete(k);
  });
  passwordResetSessions.forEach((v, k) => {
    if (v.expiresAt < now) passwordResetSessions.delete(k);
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

// ── User Login (username only) ──────────────────────────────────────────────
exports.userLogin = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
    }

    // Create user if they don't exist (auto-register on first login)
    let user = await User.findOne({ username: username.trim() });
    if (!user) {
      user = new User({ username: username.trim() });
      await user.save();
    }

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const token = generateToken({
      type: 'user',
      id: user._id.toString(),
      username: user.username,
      expiresAt
    });

    res.json({ success: true, token, username: user.username, role: 'user' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Admin Login (username + password) ──────────────────────────────────────
exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin || !admin.checkPassword(password)) {
      return res.status(401).json({ success: false, error: 'Wrong username or password' });
    }

    const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
    const token = generateToken({
      type: 'admin',
      id: admin._id.toString(),
      username: admin.username,
      expiresAt
    });

    res.json({ success: true, token, username: admin.username, role: 'admin' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Admin: request password reset code ─────────────────────────────────────
async function handleAdminRecoverySendCode(req, res, { realEmailOnly }) {
  cleanupPasswordResetStore();
  const email = normalizeEmail(req.body.email);
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }
  if (email !== ADMIN_RECOVERY_EMAIL) {
    return res.status(400).json({
      success: false,
      error: 'This email is not authorized for admin recovery'
    });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  passwordResetCodes.set(email, {
    code,
    expiresAt: Date.now() + 15 * 60 * 1000,
    attempts: 0
  });

  let sendResult;
  try {
    sendResult = await sendAdminRecoveryCode({ to: email, code, realEmailOnly });
  } catch (err) {
    passwordResetCodes.delete(email);
    console.error('Admin recovery email failed:', err.message);
    return res.status(500).json({
      success: false,
      error:
        'Could not send email. Check network or SMTP settings (e.g. Gmail App Password).'
    });
  }

  if (realEmailOnly) {
    if (!sendResult.sent || sendResult.transport !== 'smtp') {
      passwordResetCodes.delete(email);
      return res.status(503).json({
        success: false,
        error:
          'Real email delivery is not configured. Set SMTP_USER and SMTP_PASS in .env (use a Gmail App Password).',
        delivery: 'unavailable'
      });
    }
    return res.json({
      success: true,
      delivery: 'smtp',
      message: `A verification code has been sent to ${ADMIN_RECOVERY_EMAIL}.`
    });
  }

  if (!sendResult.sent) {
    console.log(`📧 Admin recovery code for ${email}: ${code}`);
    console.log('   Production without SMTP: add SMTP_USER and SMTP_PASS to .env');
  }

  let message;
  if (sendResult.sent && sendResult.transport === 'smtp') {
    message = `A verification code has been sent to ${ADMIN_RECOVERY_EMAIL}.`;
  } else if (sendResult.sent && sendResult.transport === 'ethereal') {
    message =
      'A test message with your code was created. Open the “test inbox” link (development mode).';
  } else {
    message = `Your code is in the server terminal (email not enabled for this environment).`;
  }

  return res.json({
    success: true,
    message,
    delivery: sendResult.transport || 'none',
    devInboxUrl: sendResult.previewUrl || undefined
  });
}

/** Development-friendly: allows Ethereal test inbox when SMTP is not set. */
exports.adminRequestPasswordReset = async (req, res) => {
  try {
    await handleAdminRecoverySendCode(req, res, { realEmailOnly: false });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Real inbox only (SMTP). POST body: { "email": "<ADMIN_RECOVERY_EMAIL>" }
 * No Ethereal; returns 503 if SMTP_USER / SMTP_PASS are not configured.
 */
exports.adminSendRecoveryCodeRealEmail = async (req, res) => {
  try {
    await handleAdminRecoverySendCode(req, res, { realEmailOnly: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Admin: verify code → short-lived reset token ───────────────────────────
exports.adminVerifyPasswordResetCode = async (req, res) => {
  try {
    cleanupPasswordResetStore();
    const email = normalizeEmail(req.body.email);
    const { code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Email and code are required' });
    }
    if (email !== ADMIN_RECOVERY_EMAIL) {
      return res.status(400).json({ success: false, error: 'Invalid email' });
    }

    const rec = passwordResetCodes.get(email);
    if (!rec || rec.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, error: 'Code expired or not requested. Request a new code.' });
    }
    if (rec.attempts >= 8) {
      return res.status(429).json({ success: false, error: 'Too many attempts. Request a new code.' });
    }
    if (String(code).trim() !== rec.code) {
      rec.attempts += 1;
      return res.status(400).json({ success: false, error: 'Invalid code' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    passwordResetSessions.set(resetToken, {
      email,
      expiresAt: Date.now() + 15 * 60 * 1000
    });
    passwordResetCodes.delete(email);

    res.json({ success: true, resetToken, message: 'Code verified. Set your new password.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Admin: complete reset with token + new password ────────────────────────
exports.adminCompletePasswordReset = async (req, res) => {
  try {
    cleanupPasswordResetStore();
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, error: 'Reset token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const session = passwordResetSessions.get(resetToken);
    if (!session || session.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, error: 'Reset session expired. Start again.' });
    }
    if (session.email !== ADMIN_RECOVERY_EMAIL) {
      return res.status(400).json({ success: false, error: 'Invalid session' });
    }

    const admin = await Admin.findOne({ username: 'hamed' }) || (await Admin.findOne());
    if (!admin) {
      return res.status(500).json({ success: false, error: 'Admin account not found' });
    }

    admin.setPassword(newPassword);
    await admin.save();
    passwordResetSessions.delete(resetToken);

    res.json({ success: true, message: 'Password updated. You can log in now.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Logout ──────────────────────────────────────────────────────────────────
exports.logout = (req, res) => {
  res.json({ success: true, message: 'Logged out' });
};

// ── Verify token (used by middleware) ──────────────────────────────────────
exports.verifyToken = (token) => {
  if (!token || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expectedSignature = signPayload(payload);
  if (signature !== expectedSignature) return null;

  try {
    const session = JSON.parse(fromBase64Url(payload));
    if (!session?.expiresAt || Date.now() > session.expiresAt) return null;
    return session;
  } catch (error) {
    return null;
  }
};

// ── Seed default admin ──────────────────────────────────────────────────────
exports.seedDefaultAdmin = async () => {
  const desiredUsername = 'hamed';
  const desiredPassword = 'hamed$100';

  const existingDesired = await Admin.findOne({ username: desiredUsername });
  if (!existingDesired) {
    const admin = new Admin({ username: desiredUsername });
    admin.setPassword(desiredPassword);
    await admin.save();
    console.log(`✅ Default admin created: username=${desiredUsername}, password=${desiredPassword}`);
  }
};
