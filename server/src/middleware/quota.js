import Run from '../models/Run.js';
import Subscription from '../models/Subscription.js';
import { PLANS, getPlanDetails } from '../config/plans.js';

/**
 * Quota middleware on POST /api/runs:
 * Enforces per-plan run limits, persona counts, and device choices.
 */
export async function enforceQuota(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check active subscription or user.plan
    let subscription = await Subscription.findOne({
      userId: user._id,
      status: { $in: ['active', 'cancelled'] },
    }).sort({ createdAt: -1 });

    // Handle expired subscription auto-downgrade
    if (subscription && new Date() > new Date(subscription.currentPeriodEnd)) {
      if (subscription.cancelAtPeriodEnd || subscription.status === 'cancelled') {
        subscription.status = 'expired';
        subscription.plan = 'free';
        await subscription.save();
        user.plan = 'free';
        await user.save();
      }
    }

    const planId = user.plan || subscription?.plan || 'free';
    const planConfig = getPlanDetails(planId);
    const limits = planConfig.limits;

    // Calculate current billing period start date
    const periodStart = subscription?.currentPeriodStart
      ? new Date(subscription.currentPeriodStart)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // Count runs used in current billing period
    const runsUsed = await Run.countDocuments({
      userId: user._id,
      createdAt: { $gte: periodStart },
    });

    // 1. Enforce max runs per month
    if (runsUsed >= limits.maxRunsPerMonth) {
      return res.status(402).json({
        success: false,
        code: 'QUOTA_EXCEEDED',
        message: `You have reached your limit of ${limits.maxRunsPerMonth} runs for this billing period on the ${planConfig.name} plan. Upgrade your plan to continue testing.`,
        upgradeTo: planId === 'free' ? 'pro' : 'team',
        currentUsage: {
          runsUsed,
          limit: limits.maxRunsPerMonth,
          plan: planId,
        },
      });
    }

    // 2. Enforce persona count limit
    const requestedPersonas = Number(req.body.personaCount) || 10;
    if (requestedPersonas > limits.maxPersonasPerRun) {
      return res.status(402).json({
        success: false,
        code: 'PERSONA_LIMIT_EXCEEDED',
        message: `The ${planConfig.name} plan allows up to ${limits.maxPersonasPerRun} personas per run (requested: ${requestedPersonas}). Upgrade to Pro for up to 50 personas.`,
        upgradeTo: 'pro',
      });
    }

    // 3. Enforce device support (desktop vs mobile/slow)
    const requestedDevice = req.body.device || 'desktop';
    if (!limits.allowedDevices.includes(requestedDevice)) {
      return res.status(402).json({
        success: false,
        code: 'DEVICE_NOT_ALLOWED',
        message: `Simulating ${requestedDevice} devices requires a Pro or Team plan.`,
        upgradeTo: 'pro',
      });
    }

    // Attach usage metadata to request
    req.planConfig = planConfig;
    req.runsUsed = runsUsed;
    next();
  } catch (err) {
    next(err);
  }
}
