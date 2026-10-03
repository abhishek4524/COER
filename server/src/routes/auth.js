import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { protect, generateToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';

const router = Router();

// Rate limiter for auth endpoints (100 requests per 15 mins)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many auth requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authLimiter);

// ─── Input Validation Schemas ─────────────────────────────────────────────────
const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Helper for sending verification / reset emails
async function sendEmailNotification(to, subject, body, actionLink) {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      // If Resend API key is provided, attempt to send via fetch
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Personify Auth <noreply@personify.dev>',
          to,
          subject,
          html: `<p>${body}</p><p><a href="${actionLink}">${actionLink}</a></p>`,
        }),
      });
    } catch (err) {
      console.warn('[email] Resend API call failed, falling back to console log:', err.message);
      console.log(`\n========================================`);
      console.log(`[DEV EMAIL] ${subject}`);
      console.log(`To: ${to}`);
      console.log(`Link: ${actionLink}`);
      console.log(`========================================\n`);
    }
  } else {
    // Log link to console in dev without crashing
    console.log(`\n========================================`);
    console.log(`[DEV EMAIL] ${subject}`);
    console.log(`To: ${to}`);
    console.log(`Link: ${actionLink}`);
    console.log(`========================================\n`);
  }
}

// ─── POST /api/auth/signup ───────────────────────────────────────────────────
router.post('/signup', async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      });
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create raw verification token and hash it for DB storage
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');

    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      emailVerified: false,
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      lastLoginAt: new Date(),
    });

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const verifyLink = `${clientOrigin}/verify-email?token=${rawVerificationToken}`;

    await sendEmailNotification(
      normalizedEmail,
      'Verify your Personify Account',
      `Welcome to Personify! Please click the link below to verify your email:`,
      verifyLink
    );

    const token = generateToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      data: user,
      token,
      message: 'Account created successfully.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });

    // Generic error message: never reveal whether an email exists
    if (!user || !user.passwordHash) {
      console.warn(`[AUTH] Failed login attempt for email: ${normalizedEmail} from IP: ${req.ip || req.socket.remoteAddress} at ${new Date().toISOString()}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      console.warn(`[AUTH] Failed login attempt for email: ${normalizedEmail} from IP: ${req.ip || req.socket.remoteAddress} at ${new Date().toISOString()}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);
    setAuthCookie(res, token);

    res.json({
      success: true,
      data: user,
      token,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
});

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────
router.post('/verify-email', async (req, res, next) => {
  try {
    const rawToken = req.body.token || req.query.token;
    if (!rawToken) {
      return res.status(400).json({ success: false, error: 'Verification token is required.' });
    }

    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification token.' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      });
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });

    // Generic response: never reveal whether an email exists
    if (user) {
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const hashedResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');

      user.passwordResetToken = hashedResetToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
      const resetLink = `${clientOrigin}/reset-password?token=${rawResetToken}`;

      await sendEmailNotification(
        normalizedEmail,
        'Reset your Personify Password',
        `You requested a password reset. Click the link below to set a new password:`,
        resetLink
      );
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, we sent a password reset link.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      });
    }

    const { token: rawToken, password } = parsed.data;
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired password reset token.',
      });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── Google OAuth Routes ─────────────────────────────────────────────────────
router.get('/google', (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return res.status(501).json({
      success: false,
      error: 'Google OAuth is not configured on this server. Please use email signup.',
    });
  }

  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const redirectUri = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/google/callback`;
  const scope = encodeURIComponent('openid profile email');
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;

  res.redirect(googleAuthUrl);
});

router.get('/google/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

    if (!googleClientId || !googleClientSecret || !code) {
      return res.redirect(`${clientOrigin}/login?error=Google auth unavailable`);
    }

    const redirectUri = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.redirect(`${clientOrigin}/login?error=Google authentication failed`);
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userRes.json();

    let user = await User.findOne({ $or: [{ googleId: profile.id }, { email: profile.email?.toLowerCase() }] });

    if (!user) {
      user = await User.create({
        name: profile.name || 'Google User',
        email: profile.email.toLowerCase(),
        googleId: profile.id,
        avatarUrl: profile.picture,
        emailVerified: true,
        lastLoginAt: new Date(),
      });
    } else {
      user.googleId = profile.id;
      if (profile.picture) user.avatarUrl = profile.picture;
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    res.redirect(`${clientOrigin}/app/dashboard`);
  } catch (err) {
    next(err);
  }
});

// ─── Profile Updates & Password Change ────────────────────────────────────────
router.patch('/profile', protect, async (req, res, next) => {
  try {
    const { name, avatarUrl } = req.body;
    if (name) req.user.name = name.trim();
    if (avatarUrl !== undefined) req.user.avatarUrl = avatarUrl;

    await req.user.save();
    res.json({ success: true, data: req.user, message: 'Profile updated successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters.' });
    }

    if (req.user.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, error: 'Current password is required.' });
      }
      const isMatch = await bcrypt.compare(currentPassword, req.user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Incorrect current password.' });
      }
    }

    req.user.passwordHash = await bcrypt.hash(newPassword, 12);
    await req.user.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/account', protect, async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    clearAuthCookie(res);
    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// ─── Settings Updates ─────────────────────────────────────────────────────────
router.patch('/settings', protect, async (req, res, next) => {
  try {
    const { theme, defaultDevice, defaultPersonaCount } = req.body;
    if (!req.user.settings) {
      req.user.settings = {};
    }

    if (theme && ['light', 'dark', 'system'].includes(theme)) {
      req.user.settings.theme = theme;
    }
    if (defaultDevice && ['desktop', 'mobile', 'tablet'].includes(defaultDevice)) {
      req.user.settings.defaultDevice = defaultDevice;
    }
    if (defaultPersonaCount && Number.isInteger(Number(defaultPersonaCount))) {
      req.user.settings.defaultPersonaCount = Math.min(50, Math.max(1, Number(defaultPersonaCount)));
    }

    await req.user.save();
    res.json({ success: true, settings: req.user.settings });
  } catch (err) {
    next(err);
  }
});

// ─── API Key Generation & Revocation ──────────────────────────────────────────
router.post('/api-key', protect, async (req, res, next) => {
  try {
    const { name } = req.body;
    const randomHex = crypto.randomBytes(24).toString('hex');
    const rawKey = `personify_sk_${randomHex}`;
    const keyPrefix = rawKey.substring(0, 16) + '...';
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    if (!req.user.apiKeys) {
      req.user.apiKeys = [];
    }

    const newKeyObj = {
      keyHash,
      keyPrefix,
      name: name ? name.trim() : 'Default API Key',
      createdAt: new Date(),
    };

    req.user.apiKeys.push(newKeyObj);
    await req.user.save();

    const created = req.user.apiKeys[req.user.apiKeys.length - 1];

    res.status(201).json({
      success: true,
      apiKey: rawKey,
      keyInfo: {
        _id: created._id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/api-key/:keyId', protect, async (req, res, next) => {
  try {
    const { keyId } = req.params;
    if (!req.user.apiKeys) req.user.apiKeys = [];

    req.user.apiKeys = req.user.apiKeys.filter((k) => k._id.toString() !== keyId);
    await req.user.save();

    res.json({ success: true, message: 'API key revoked.' });
  } catch (err) {
    next(err);
  }
});

export default router;
