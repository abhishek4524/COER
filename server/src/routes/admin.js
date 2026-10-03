import express from 'express';
import { protect } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Run } from '../models/Run.js';
import { Payment } from '../models/Payment.js';
import { Subscription } from '../models/Subscription.js';

const router = express.Router();
router.use(protect);

// Require admin role middleware
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

router.use(requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRuns = await Run.countDocuments();
    const proCount = await User.countDocuments({ plan: 'pro' });
    const teamCount = await User.countDocuments({ plan: 'team' });

    // Revenue calculation
    const capturedPayments = await Payment.find({ status: { $in: ['captured', 'completed', 'paid'] } });
    const totalRevenue = capturedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Runs per day for last 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentRuns = await Run.find({ createdAt: { $gte: fourteenDaysAgo } }).select('status createdAt').lean();

    const runsMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      runsMap[key] = 0;
    }

    recentRuns.forEach((r) => {
      const key = new Date(r.createdAt).toISOString().split('T')[0];
      if (runsMap[key] !== undefined) {
        runsMap[key]++;
      }
    });

    const runsPerDay = Object.keys(runsMap).map((date) => ({
      date,
      count: runsMap[date],
    }));

    // Failed runs
    const failedRunsCount = await Run.countDocuments({ status: 'failed' });
    const recentFailedRuns = await Run.find({ status: 'failed' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id targetUrl targetGoal failureReason createdAt')
      .lean();

    // Recent Users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select('name email role plan createdAt lastLoginAt')
      .lean();

    res.json({
      overview: {
        totalUsers,
        totalRuns,
        proUsers: proCount,
        teamUsers: teamCount,
        totalRevenue: Math.round(totalRevenue / 100), // convert paise to INR if stored in paise
        failedRunsCount,
      },
      runsPerDay,
      failedRuns: recentFailedRuns,
      recentUsers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id/role - promote or demote user
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    targetUser.role = role;
    await targetUser.save();

    res.json({ user: targetUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
