import { Router } from 'express';
import Run from '../models/Run.js';
import Session from '../models/Session.js';
import { protect } from '../middleware/auth.js';

const router = Router();

function getDomain(urlStr) {
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return urlStr || 'unknown';
  }
}

// GET /api/me/stats
router.get('/stats', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Fetch all user runs sorted by date ascending
    const userRuns = await Run.find({ userId }).sort({ createdAt: 1 });

    const totalRuns = userRuns.length;
    const runIds = userRuns.map((r) => r._id);

    // Fetch sessions for user's runs
    const sessions = await Session.find({ runId: { $in: runIds } });
    const totalSessions = sessions.length;

    // Unique personas simulated across user's sessions
    const uniquePersonaIds = new Set();
    sessions.forEach((s) => {
      if (s.personaId) uniquePersonaIds.add(s.personaId.toString());
    });
    const totalPersonasSimulated = uniquePersonaIds.size || (sessions.length > 0 ? sessions.length : 0);

    // Group runs by domain
    const websiteMap = new Map();
    for (const run of userRuns) {
      const domain = getDomain(run.url);
      if (!websiteMap.has(domain)) {
        websiteMap.set(domain, {
          domain,
          runCount: 0,
          lastTestedAt: run.createdAt,
          bestSuccessRate: 0,
          latestFrictionScore: 0,
          runs: [],
        });
      }
      const site = websiteMap.get(domain);
      site.runCount += 1;
      if (new Date(run.createdAt) >= new Date(site.lastTestedAt)) {
        site.lastTestedAt = run.createdAt;
        site.latestFrictionScore = Math.round(run.scores?.frictionIndex ?? 0);
      }
      const successRate = Math.round(run.scores?.taskSuccessRate ?? 0);
      if (successRate > site.bestSuccessRate) {
        site.bestSuccessRate = successRate;
      }
      site.runs.push(run);
    }

    const websites = Array.from(websiteMap.values()).map((site) => ({
      domain: site.domain,
      runCount: site.runCount,
      lastTestedAt: site.lastTestedAt,
      bestSuccessRate: site.bestSuccessRate,
      latestFrictionScore: site.latestFrictionScore,
    }));

    const totalWebsites = websites.length;

    // Runs per month and average friction trend for the last 6 months
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        label: d.toLocaleString('en-US', { month: 'short' }),
      });
    }

    const runsPerMonthMap = new Map(months.map((m) => [`${m.year}-${m.monthIndex}`, { label: m.label, count: 0, totalFriction: 0 }]));

    let currentMonthRuns = 0;
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

    for (const run of userRuns) {
      const rDate = new Date(run.createdAt);
      const key = `${rDate.getFullYear()}-${rDate.getMonth()}`;

      if (key === currentMonthKey) {
        currentMonthRuns += 1;
      }

      if (runsPerMonthMap.has(key)) {
        const item = runsPerMonthMap.get(key);
        item.count += 1;
        item.totalFriction += (run.scores?.frictionIndex ?? 0);
      }
    }

    const runsPerMonth = Array.from(runsPerMonthMap.values()).map((m) => ({
      month: m.label,
      count: m.count,
    }));

    const avgFrictionTrend = Array.from(runsPerMonthMap.values()).map((m) => ({
      month: m.label,
      avgFriction: m.count > 0 ? Math.round(m.totalFriction / m.count) : 0,
    }));

    const quotaLimitMap = { free: 10, pro: 100, team: 500 };
    const quotaLimit = quotaLimitMap[req.user.plan] || 10;

    const quotaUsage = {
      used: currentMonthRuns,
      limit: quotaLimit,
      plan: req.user.plan,
      remaining: Math.max(0, quotaLimit - currentMonthRuns),
    };

    res.json({
      success: true,
      data: {
        totalRuns,
        totalSessions,
        totalPersonasSimulated,
        totalWebsites,
        websites,
        runsPerMonth,
        avgFrictionTrend,
        quotaUsage,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
