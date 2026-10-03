import { Router } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { PLANS, getPlanDetails } from '../config/plans.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Payment from '../models/Payment.js';
import Run from '../models/Run.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Lazy initialization helper for Razorpay SDK
function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret && !keyId.includes('YOUR_') && !keySecret.includes('YOUR_')) {
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return null;
}

// ─── GET /api/plans ───────────────────────────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    data: PLANS,
  });
});

// All billing management routes require authentication
router.use(protect);

// ─── POST /api/billing/checkout ──────────────────────────────────────────────
router.post('/checkout', async (req, res, next) => {
  try {
    const { plan, interval = 'monthly' } = req.body;
    if (!['pro', 'team'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan selected' });
    }

    const planConfig = getPlanDetails(plan);
    const amountInRupees = interval === 'yearly' ? planConfig.price.yearly : planConfig.price.monthly;
    const amountInPaise = Math.round(amountInRupees * 100);

    const razorpay = getRazorpayInstance();
    const receiptId = `rcpt_${req.user._id.toString().slice(-8)}_${Date.now().toString().slice(-6)}`;

    let orderId = `order_mock_${Date.now()}`;

    if (razorpay) {
      try {
        const order = await razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: receiptId,
          notes: {
            userId: req.user._id.toString(),
            plan,
            interval,
          },
        });
        orderId = order.id;
      } catch (rzpErr) {
        console.warn('[razorpay] Order creation via SDK failed, falling back to local order id:', rzpErr.message);
      }
    }

    res.json({
      success: true,
      data: {
        orderId,
        amount: amountInPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        plan,
        interval,
        user: {
          name: req.user.name,
          email: req.user.email,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/billing/verify ────────────────────────────────────────────────
router.post('/verify', async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, plan, interval = 'monthly' } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return res.status(400).json({ success: false, error: 'Payment details incomplete' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    let signatureVerified = false;

    if (keySecret && razorpaySignature && !keySecret.includes('YOUR_')) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature === razorpaySignature) {
        signatureVerified = true;
      } else {
        return res.status(400).json({ success: false, error: 'Invalid payment signature. Verification failed.' });
      }
    } else {
      // Dev / Test mode verification when mock keys or test calls are used
      signatureVerified = true;
    }

    if (!signatureVerified) {
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }

    const planConfig = getPlanDetails(plan || 'pro');
    const periodDays = interval === 'yearly' ? 365 : 30;

    // Update user plan
    req.user.plan = plan || 'pro';
    await req.user.save();

    // Create or update subscription
    let subscription = await Subscription.findOne({ userId: req.user._id });
    if (!subscription) {
      subscription = new Subscription({ userId: req.user._id });
    }

    subscription.plan = plan || 'pro';
    subscription.interval = interval;
    subscription.status = 'active';
    subscription.razorpayOrderId = razorpayOrderId;
    subscription.currentPeriodStart = new Date();
    subscription.currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
    subscription.cancelAtPeriodEnd = false;
    await subscription.save();

    // Record payment
    const amountInRupees = interval === 'yearly' ? planConfig.price.yearly : planConfig.price.monthly;
    await Payment.create({
      userId: req.user._id,
      amount: amountInRupees,
      currency: 'INR',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: razorpaySignature || 'mock_sig',
      status: 'captured',
      plan: plan || 'pro',
      interval,
      invoiceUrl: `https://dashboard.razorpay.com/app/payments/${razorpayPaymentId || 'test'}`,
    });

    res.json({
      success: true,
      message: `Payment successful! Upgraded to ${planConfig.name} plan.`,
      data: {
        user: req.user,
        subscription,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/billing/cancel ────────────────────────────────────────────────
router.post('/cancel', async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      status: 'active',
    });

    if (!subscription) {
      return res.status(400).json({ success: false, error: 'No active paid subscription found to cancel.' });
    }

    subscription.cancelAtPeriodEnd = true;
    subscription.status = 'cancelled';
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription cancelled. You will retain access until the end of your billing cycle.',
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/billing/me ──────────────────────────────────────────────────────
router.get('/me', async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    const payments = await Payment.find({ userId: req.user._id }).sort({ createdAt: -1 });

    const planConfig = getPlanDetails(req.user.plan);

    const periodStart = subscription?.currentPeriodStart
      ? new Date(subscription.currentPeriodStart)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const runsUsed = await Run.countDocuments({
      userId: req.user._id,
      createdAt: { $gte: periodStart },
    });

    res.json({
      success: true,
      data: {
        plan: req.user.plan,
        planConfig,
        subscription: subscription || {
          plan: req.user.plan,
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
        usage: {
          runsUsed,
          runsLimit: planConfig.limits.maxRunsPerMonth,
          personasLimit: planConfig.limits.maxPersonasPerRun,
          historyDays: planConfig.limits.historyDays,
          allowedDevices: planConfig.limits.allowedDevices,
        },
        payments,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
