const nodemailer = require('nodemailer');

/** Google shows app passwords with spaces; SMTP expects 16 chars without spaces. */
function normalizeSmtpPass(pass) {
  if (!pass) return '';
  return String(pass).replace(/\s+/g, '').trim();
}

function isSmtpConfigured() {
  const user = process.env.SMTP_USER && process.env.SMTP_USER.trim();
  const pass = normalizeSmtpPass(process.env.SMTP_PASS);
  return Boolean(user && pass.length >= 8);
}

/** In development, Nodemailer Ethereal sends mail without any .env SMTP setup. */
function useEtherealFallback() {
  return process.env.NODE_ENV !== 'production';
}

let realTransporter;
let etherealTransporterPromise;
let etherealReadyLogged;

function getRealTransporter() {
  if (!isSmtpConfigured()) return null;
  if (realTransporter) return realTransporter;

  const host = (process.env.SMTP_HOST || '').trim().toLowerCase();
  const useGmailPreset = !host || host === 'smtp.gmail.com';

  if (useGmailPreset) {
    realTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER.trim(),
        pass: normalizeSmtpPass(process.env.SMTP_PASS)
      }
    });
  } else {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    realTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER.trim(),
        pass: normalizeSmtpPass(process.env.SMTP_PASS)
      }
    });
  }

  return realTransporter;
}

async function getEtherealTransporter() {
  if (etherealTransporterPromise) return etherealTransporterPromise;

  etherealTransporterPromise = (async () => {
    const account = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: account.user,
        pass: account.pass
      }
    });
  })();

  return etherealTransporterPromise;
}

async function verifySmtpAtStartup() {
  if (isSmtpConfigured()) {
    try {
      const t = getRealTransporter();
      await t.verify();
      console.log('📧 SMTP: connected — reset codes go to your real inbox (Gmail/SMTP).');
    } catch (err) {
      console.error('📧 SMTP: login failed —', err.message);
      console.error('   Use a Google App Password, not your normal Gmail password.');
    }
    return;
  }

  if (useEtherealFallback()) {
    console.log(
      '📧 Admin reset: auto test email (Ethereal) — after "Send code", open the link shown in the app to read your code.'
    );
    try {
      await getEtherealTransporter();
    } catch (err) {
      console.error('📧 Ethereal setup failed:', err.message);
    }
    return;
  }

  console.log('📧 Admin password reset: set SMTP_USER + SMTP_PASS in .env to send real email.');
}

/**
 * @param {{ to: string, code: string, realEmailOnly?: boolean }} opts
 *   If realEmailOnly is true, only SMTP to a real inbox is used (no Ethereal fallback).
 * @returns {Promise<{ sent: boolean, transport?: 'smtp'|'ethereal', previewUrl?: string, reason?: string }>}
 */
async function sendAdminRecoveryCode({ to, code, realEmailOnly = false }) {
  const subject = 'Coffee House — admin password reset code';
  const text = `Your admin password reset code is: ${code}\n\nIt expires in 15 minutes. If you did not request this, ignore this email.`;
  const html = `<p>Your admin password reset code is:</p><p style="font-size:1.5rem;font-weight:bold;letter-spacing:0.15em">${code}</p><p>It expires in 15 minutes.</p><p>If you did not request this, ignore this email.</p>`;

  if (isSmtpConfigured()) {
    const from = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
    const transport = getRealTransporter();
    await transport.sendMail({
      from: from || process.env.SMTP_USER.trim(),
      to,
      subject,
      text,
      html
    });
    return { sent: true, transport: 'smtp' };
  }

  if (realEmailOnly) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  if (useEtherealFallback()) {
    const transport = await getEtherealTransporter();
    const info = await transport.sendMail({
      from: '"Coffee House (dev)" <no-reply@coffee-house.local>',
      to,
      subject,
      text,
      html
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (!etherealReadyLogged) {
      etherealReadyLogged = true;
      if (previewUrl) console.log('📧 Ethereal preview (first reset this run):', previewUrl);
    }
    return { sent: true, transport: 'ethereal', previewUrl: previewUrl || undefined };
  }

  return { sent: false, reason: 'smtp_not_configured' };
}

module.exports = {
  isSmtpConfigured,
  verifySmtpAtStartup,
  sendAdminRecoveryCode
};
