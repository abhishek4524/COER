import { Router } from 'express';
import crypto, { createHash } from 'crypto';
import Run from '../models/Run.js';
import Session from '../models/Session.js';
import Step from '../models/Step.js';
import { verifyOwnership } from '../middleware/verifyOwnership.js';
import { buildRunMetrics, buildPerPersonaTypeScores, buildDropOffFunnel } from '../services/aggregator.js';
import { protect } from '../middleware/auth.js';
import { enforceQuota } from '../middleware/quota.js';

import { validateTargetUrl } from '../utils/security.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for run creation
const runCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many simulation creation requests. Please wait a few minutes.' },
});

// All run routes require authentication
router.use(protect);

// ─── Helper: Start Run Execution ──────────────────────────────────────────────
async function triggerRunExecution(run, app) {
  const simulationQueue = app.get('simulationQueue');
  let enqueued = false;

  if (simulationQueue) {
    try {
      await simulationQueue.add('simulate', { runId: run._id.toString() }, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
      });
      run.status = 'queued';
      await run.save();
      enqueued = true;
    } catch (qErr) {
      console.warn('[BullMQ] Could not enqueue run:', qErr.message);
    }
  }

  if (!enqueued) {
    run.status = 'running';
    await run.save();

    import('../workers/agent.js').then(({ processAgentRun }) => {
      processAgentRun(run._id, io).catch(async (err) => {
        console.error('[direct-run] Agent run failed:', err.message);
        try {
          await Run.findByIdAndUpdate(run._id, {
            status: 'failed',
            'summary.errorMessage': err.message,
            completedAt: new Date(),
          });
          io?.to(`run:${run._id}`).emit('run:failed', { runId: run._id, error: err.message });
        } catch (saveErr) {
          console.error('[direct-run] Could not save failed status:', saveErr.message);
        }
      });
    });
  }
}

// ─── Helper: Generate Screen Aggregations ──────────────────────────────────────
function buildScreensFromSteps(steps = []) {
  const screensMap = new Map();

  for (const step of steps) {
    const urlKey = step.url || 'default';
    if (!screensMap.has(urlKey)) {
      let label = 'Screen';
      try {
        const parsed = new URL(urlKey);
        label = parsed.pathname === '/' ? 'Product / Home Page' : parsed.pathname.replace('/', '').toUpperCase() + ' Page';
      } catch {
        label = step.pageTitle || 'Tested Screen';
      }

      const screenId = createHash('md5').update(urlKey).digest('hex').slice(0, 12);
      screensMap.set(urlKey, {
        id: screenId,
        url: step.url,
        name: step.pageTitle || label,
        label: step.pageTitle || label,
        screenshot: step.screenshotUrl,
        thumbnail: step.screenshotUrl,
        frictionDot: '#8FB8A8',
        frictionScore: 0,
        clickPoints: [],
        rageClusters: [],
        deadClickPoints: [],
        personaPins: [],
        hotspots: [],
      });
    }

    const scr = screensMap.get(urlKey);
    if (step.screenshotUrl && !scr.screenshot) {
      scr.screenshot = step.screenshotUrl;
      scr.thumbnail = step.screenshotUrl;
    }

    if (step.x != null && step.y != null) {
      const pt = {
        x: step.x,
        y: step.y,
        type: step.action === 'rage_click' ? 'rage' : step.isDeadClick ? 'dead' : 'click',
        weight: step.frustration > 60 ? 2 : 1,
        timestamp: step.ts,
      };
      scr.clickPoints.push(pt);
      if (step.action === 'rage_click') scr.rageClusters.push(pt);
      if (step.isDeadClick) scr.deadClickPoints.push(pt);

      if (step.thought) {
        scr.personaPins.push({
          id: `pin-${step._id}`,
          x: step.x,
          y: step.y,
          name: step.personaName || 'Tester',
          emotion: step.emotion || 'neutral',
          quote: step.thought,
          frustration: step.frustration,
        });
      }
    }

    if (scr.rageClusters.length > 1) scr.frictionDot = 'coral';
    else if (scr.deadClickPoints.length > 1) scr.frictionDot = 'amber';
  }

  return Array.from(screensMap.values());
}

// ─── POST /api/runs ──────────────────────────────────────────────────────────
router.post('/', runCreationLimiter, enforceQuota, async (req, res, next) => {
  try {
    let { url, goal, personaCount, device, selectedPersonas } = req.body;

    // SSRF Validation & Protection
    try {
      url = validateTargetUrl(url);
    } catch (ssrfErr) {
      return res.status(400).json({ success: false, error: ssrfErr.message });
    }
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }

    const count = Math.min(50, Math.max(1, Number(personaCount) || 10));
    const verificationToken = crypto.randomBytes(20).toString('hex');

    const hostname = (() => {
      try { return new URL(url).hostname; } catch { return ''; }
    })();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const isDev = process.env.NODE_ENV !== 'production';
    const allowUnverifiedDev = process.env.ALLOW_UNVERIFIED_DEV === 'true';

    // Auto-verify if local OR development mode with ALLOW_UNVERIFIED_DEV=true
    const ownershipVerified = isLocal || (isDev && allowUnverifiedDev);

    const run = await Run.create({
      userId: req.user._id,
      url,
      goal: (goal && goal.trim()) ? goal.trim() : 'Explore website and complete key tasks',
      personaCount: count,
      device: device || 'desktop',
      selectedPersonas,
      verificationToken,
      ownershipVerified,
      verificationMethod: ownershipVerified ? (isLocal ? 'localhost_bypass' : 'dev_bypass') : null,
      status: ownershipVerified ? 'running' : 'pending_verification',
      summary: {
        schemaVersion: 2,
        totalSessions: count,
        completedCount: 0,
        gaveUpCount: 0,
        taskSuccessRate: 0,
        avgFrustration: 0,
        avgSessionTime: 0,
        ctaMissRate: 0,
        frictionScore: 0,
        topIssues: [],
        funnel: [],
        personaTypeScores: [],
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`run:${run._id}`).emit('run:created', {
        runId: run._id,
        status: run.status,
        verificationToken,
      });
    }

    if (ownershipVerified) {
      await triggerRunExecution(run, req.app);
    }

    res.status(201).json({
      success: true,
      data: run,
      verificationToken,
      verificationInstructions: {
        metaTag: `<meta name="personify-verify" content="${verificationToken}">`,
        txtFile: `Create /personify-verify.txt containing: ${verificationToken}`,
      },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

// ─── GET /api/runs ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const runs = await Run.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Run.countDocuments(filter);
    res.json({ success: true, data: runs, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/runs/:id/report (Single Source of Truth) ────────────────────────
router.get('/:id/report', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run || !run.userId.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }

    const sessions = await Session.find({ runId: run._id })
      .populate('personaId', 'name age traits avatarSet avatar')
      .sort({ createdAt: 1 })
      .lean();

    const allSteps = await Step.find({ runId: run._id }).sort({ stepIndex: 1, ts: 1 }).lean();

    const sessionsWithSteps = sessions.map((s) => ({
      ...s,
      steps: allSteps.filter((st) => st.sessionId?.toString() === s._id?.toString()),
    }));

    const metrics = buildRunMetrics(sessionsWithSteps);
    const personaTypeScores = (run.summary?.personaTypeScores?.length > 0)
      ? run.summary.personaTypeScores
      : buildPerPersonaTypeScores(sessions);
    const funnel = (run.summary?.funnel?.length > 0)
      ? run.summary.funnel
      : buildDropOffFunnel(sessionsWithSteps);
    const insights = run.summary?.topIssues || [];
    const screens = buildScreensFromSteps(allSteps);

    const taskSuccessRate = run.scores?.taskSuccessRate ?? metrics.taskSuccessRate;
    const avgFrustration = run.scores?.avgFrustration ?? metrics.avgFrustration;
    const ctaMissRate = run.scores?.ctaMissRate ?? metrics.ctaMissRate;
    const avgSessionTime = run.scores?.avgSessionTime ?? metrics.avgSessionTime;
    const frictionScore = run.summary?.frictionScore ?? metrics.frictionScore;

    res.json({
      success: true,
      data: {
        run: {
          id: run._id,
          _id: run._id,
          url: run.url,
          goal: run.goal,
          status: run.status,
          personaCount: run.personaCount,
          device: run.device,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
          ownershipVerified: run.ownershipVerified,
          verificationToken: run.verificationToken,
          summary: run.summary,
        },
        metrics: {
          taskSuccessRate,
          avgFrustration,
          ctaMissRate,
          avgSessionTime,
          frictionScore,
          completedCount: metrics.completedCount,
          gaveUpCount: metrics.gaveUpCount,
          totalSessions: metrics.totalSessions,
          sparklines: {
            taskSuccess: [
              { value: Math.max(0, taskSuccessRate - 12) },
              { value: Math.max(0, taskSuccessRate - 4) },
              { value: taskSuccessRate },
            ],
            frustration: [
              { value: Math.max(0, avgFrustration - 8) },
              { value: Math.min(100, avgFrustration + 4) },
              { value: avgFrustration },
            ],
            dropOff: [
              { value: Math.min(100, ctaMissRate + 10) },
              { value: ctaMissRate },
            ],
            sessionTime: [
              { value: Math.max(5, avgSessionTime - 8) },
              { value: avgSessionTime },
            ],
          },
        },
        insights: insights.map((issue, idx) => ({
          id: `ins-${idx}`,
          icon: issue.severity === 'critical' ? 'AlertTriangle' : issue.severity === 'high' ? 'Zap' : 'MessageSquare',
          severity: issue.severity,
          issue: issue.title,
          detail: issue.description,
          suggestedFix: issue.suggestedFix,
          affectedCount: Math.min(metrics.totalSessions || 1, issue.affectedCount || 1),
          affectedPersonaIds: sessions.slice(0, issue.affectedCount || 1).map((s) => s.personaId?._id || s.personaId),
        })),
        funnel,
        personaTypeScores,
        sessions: sessionsWithSteps,
        screens,
        heatmapPoints: metrics.heatmapPoints,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/runs/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run || !run.userId.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }
    res.json({ success: true, data: run });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/runs/:id/sessions ──────────────────────────────────────────────
router.get('/:id/sessions', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run || !run.userId.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }

    const sessions = await Session.find({ runId: req.params.id })
      .populate('personaId', 'name age traits avatarSet avatar')
      .sort({ createdAt: 1 });

    res.json({ success: true, data: sessions, count: sessions.length });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/runs/:id/screens ───────────────────────────────────────────────
router.get('/:id/screens', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run || !run.userId.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }

    const steps = await Step.find({ runId: req.params.id }).sort({ stepIndex: 1, ts: 1 }).lean();
    const screens = buildScreensFromSteps(steps);
    res.json({ success: true, data: screens, count: screens.length });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/runs/:id/verify-ownership ─────────────────────────────────────
router.post('/:id/verify-ownership', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run || !run.userId.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }

    const { verified, method } = await verifyOwnership(run.url, run.verificationToken);

    run.ownershipVerified = verified;
    if (verified) {
      run.verificationMethod = method;
      run.status = 'running';
      await run.save();
      await triggerRunExecution(run, req.app);
    } else {
      await run.save();
    }

    res.json({
      success: true,
      verified,
      method,
      status: run.status,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/runs/:id ─────────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run || !run.userId.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }

    const allowed = ['status', 'summary', 'scores', 'completedAt'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    Object.assign(run, updates);
    await run.save();

    const io = req.app.get('io');
    if (io && updates.status === 'completed') {
      io.to(`run:${run._id}`).emit('run:finished', { runId: run._id, summary: run.summary });
    }

    res.json({ success: true, data: run });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/runs/:id/share ─────────────────────────────────────────────────
router.post('/:id/share', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run || !run.userId.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }

    const { daysValid } = req.body;
    const shareToken = crypto.randomBytes(16).toString('hex');
    const shareExpiresAt = daysValid ? new Date(Date.now() + Number(daysValid) * 24 * 60 * 60 * 1000) : null;

    run.shareToken = shareToken;
    run.shareExpiresAt = shareExpiresAt;
    await run.save();

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const shareUrl = `${clientOrigin}/shared/${shareToken}`;

    res.json({
      success: true,
      data: {
        shareToken,
        shareUrl,
        shareExpiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/runs/:id/share (Revoke) ──────────────────────────────────────
router.delete('/:id/share', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run || !run.userId.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }

    run.shareToken = null;
    run.shareExpiresAt = null;
    await run.save();

    res.json({ success: true, message: 'Share link revoked successfully.' });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/runs/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run || !run.userId.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }

    await Run.findByIdAndDelete(req.params.id);
    await Session.deleteMany({ runId: req.params.id });
    await Step.deleteMany({ runId: req.params.id });

    res.json({ success: true, message: 'Run deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
