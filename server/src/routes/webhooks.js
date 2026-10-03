import { Router } from 'express';
import crypto from 'crypto';
import WebhookEvent from '../models/WebhookEvent.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Payment from '../models/Payment.js';
import { getPlanDetails } from '../config/plans.js';

const router = Router();

// Express raw parser handling if needed
router.post('/razorpay', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyString)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('[webhook] Signature mismatch for Razorpay webhook');
        return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
      }
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventId = payload.event_id || payload.id || `evt_${Date.now()}`;
    const eventType = payload.event;

    // ─── Idempotency Check ───────────────────────────────────────────────────
    const existing = await WebhookEvent.findOne({ eventId });
    if (existing) {
      console.log(`[webhook] Event ${eventId} (${eventType}) already processed. Skipping.`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Save event for idempotency
    await WebhookEvent.create({ eventId, eventType });

    console.log(`[webhook] Processing Razorpay Event: ${eventType} (${eventId})`);

    // Handle Event Types
    switch (eventType) {
      case 'payment.captured': {
        const entity = payload.payload?.payment?.entity;
        if (entity) {
          const notes = entity.notes || {};
          const userId = notes.userId;
          const plan = notes.plan || 'pro';
          const interval = notes.interval || 'monthly';

          if (userId) {
            const user = await User.findById(userId);
            if (user) {
              user.plan = plan;
              await user.save();

              const periodDays = interval === 'yearly' ? 365 : 30;
              await Subscription.findOneAndUpdate(
                { userId: user._id },
                {
                  plan,
                  interval,
                  status: 'active',
                  razorpayOrderId: entity.order_id,
                  currentPeriodStart: new Date(),
                  currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
                  cancelAtPeriodEnd: false,
                },
                { upsert: true, new: true }
              );

              await Payment.create({
                userId: user._id,
                amount: entity.amount / 100,
                currency: entity.currency || 'INR',
                razorpayPaymentId: entity.id,
                razorpayOrderId: entity.order_id,
                status: 'captured',
                plan,
                interval,
                invoiceUrl: `https://dashboard.razorpay.com/app/payments/${entity.id}`,
              });

              console.log(`[webhook] Upgraded user ${user.email} to ${plan} via payment.captured`);
            }
          }
        }
        break;
      }

      case 'subscription.activated':
      case 'subscription.charged': {
        const subEntity = payload.payload?.subscription?.entity;
        if (subEntity) {
          const razorpaySubscriptionId = subEntity.id;
          const sub = await Subscription.findOne({ razorpaySubscriptionId });
          if (sub) {
            sub.status = 'active';
            sub.currentPeriodStart = new Date(subEntity.current_start * 1000 || Date.now());
            sub.currentPeriodEnd = new Date(subEntity.current_end * 1000 || Date.now() + 30 * 24 * 60 * 60 * 1000);
            await sub.save();

            await User.findByIdAndUpdate(sub.userId, { plan: sub.plan });
            console.log(`[webhook] Subscription ${subEntity.id} active/charged. Plan: ${sub.plan}`);
          }
        }
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.halted': {
        const subEntity = payload.payload?.subscription?.entity;
        if (subEntity) {
          const razorpaySubscriptionId = subEntity.id;
          const sub = await Subscription.findOne({ razorpaySubscriptionId });
          if (sub) {
            sub.status = 'expired';
            sub.plan = 'free';
            await sub.save();

            await User.findByIdAndUpdate(sub.userId, { plan: 'free' });
            console.log(`[webhook] Subscription ${subEntity.id} cancelled/halted. User downgraded to Free.`);
          }
        }
        break;
      }

      case 'payment.failed': {
        const entity = payload.payload?.payment?.entity;
        if (entity) {
          console.warn(`[webhook] Payment ${entity.id} failed for amount ${entity.amount / 100}`);
        }
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${eventType}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] Webhook processing error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
