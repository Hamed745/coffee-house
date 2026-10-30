const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// POST /api/auth/user-login   – username only
router.post('/user-login', authController.userLogin);

// POST /api/auth/admin-login  – username + password
router.post('/admin-login', authController.adminLogin);

// Admin password recovery (registered recovery email only)
router.post('/admin-request-password-reset', authController.adminRequestPasswordReset);
// Same flow as above but sends only via real SMTP (Gmail, etc.) — no Ethereal / dev inbox
router.post('/admin-recovery/send-code-email', authController.adminSendRecoveryCodeRealEmail);
router.post('/admin-verify-reset-code', authController.adminVerifyPasswordResetCode);
router.post('/admin-complete-password-reset', authController.adminCompletePasswordReset);

// POST /api/auth/logout
router.post('/logout', requireAuth, authController.logout);

module.exports = router;
