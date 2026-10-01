import { Router } from 'express';
import crypto from 'crypto';
import Run from '../models/Run.js';
import Session from '../models/Session.js';
import { verifyOwnershipHandler } from '../middleware/verifyOwnership.js';

const router = Router();

// ─── POST /api/runs ──────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    let { url, goal, personaCount, device, selectedPersonas } = req.body;

    // Normalize URL format
    if (url && !/^https?:\/\//i.test(url.trim())) {
      url = 'https://' + url.trim();
    }

    // Generate a unique verification token for this run
    const verificationToken = crypto.randomBytes(20).toString('hex');

    const hostname = (() => {
      try { return new URL(url).hostname; } catch { return ''; }
    })();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const isDev = process.env.NODE_ENV !== 'production';

    // In dev mode, auto-verify all URLs so external real sites can be tested easily
    const ownershipVerified = isDev || isLocal;

    const run = await Run.create({
      url,
      goal,
      personaCount: personaCount || 10,
      device: device || 'desktop',
      selectedPersonas,
      verificationToken,
      ownershipVerified,
      verificationMethod: ownershipVerified ? (isLocal ? 'localhost_bypass' : 'dev_bypass') : null,
      status: ownershipVerified ? 'queued' : 'pending_verification',
    });

    // Emit to Socket.io room (io is attached to req.app)
    const io = req.app.get('io');
    if (io) {
      io.to(`run:${run._id}`).emit('run:created', {
        runId: run._id,
        status: run.status,
        verificationToken,
      });
    }

    // Try to queue with BullMQ, or fall back to direct background execution
    const simulationQueue = req.app.get('simulationQueue');
    let enqueued = false;
    if (simulationQueue && (run.ownershipVerified || isDev)) {
      try {
        await simulationQueue.add('simulate', { runId: run._id.toString() }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        });
        run.status = 'queued';
        await run.save();
        enqueued = true;
      } catch (qErr) {
        console.warn('[BullMQ] Could not enqueue run (Redis may be offline):', qErr.message);
      }
    }

    // Fallback: run directly in background with Playwright worker
    if (!enqueued && (run.ownershipVerified || isDev)) {
      run.status = 'running';
      await run.save();
      // Import worker dynamically to avoid circular dependencies
      import('../workers/agent.js').then(({ processAgentRun }) => {
        processAgentRun(run._id, io).catch((err) => {
          console.error('[direct-run] Error running agent simulation:', err.message);
        });
      });
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
    next(err);
  }
});

// ─── GET /api/runs ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
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

// ─── GET /api/runs/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    res.json({ success: true, data: run });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/runs/:id/sessions ──────────────────────────────────────────────
router.get('/:id/sessions', async (req, res, next) => {
  try {
    const run = await Run.findById(req.params.id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    const sessions = await Session.find({ runId: req.params.id })
      .populate('personaId', 'name age traits avatarSet')
      .sort({ createdAt: 1 });

    res.json({ success: true, data: sessions, count: sessions.length });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/runs/:id/verify-ownership ─────────────────────────────────────
router.post('/:id/verify-ownership', verifyOwnershipHandler);

// ─── GET /api/runs/:id/screens ─────────────────────────────────────────────
router.get('/:id/screens', async (req, res, next) => {
  try {
    const Step = (await import('../models/Step.js')).default;
    const steps = await Step.find({ runId: req.params.id }).sort({ stepIndex: 1, ts: 1 });
    
    // Group steps by page URL or title
    const screensMap = new Map();
    for (const step of steps) {
      const urlKey = step.url || 'default';
      if (!screensMap.has(urlKey)) {
        let label = 'Screen';
        try {
          const parsed = new URL(urlKey);
          label = parsed.pathname === '/' ? 'Product Page' : parsed.pathname.replace('/', '').toUpperCase() + ' Page';
        } catch {
          label = step.pageTitle || 'Tested Screen';
        }

        screensMap.set(urlKey, {
          id: Buffer.from(urlKey).toString('base64url').slice(0, 12),
          url: step.url,
          name: step.pageTitle || label,
          screenshot: step.screenshotUrl,
          thumbnail: step.screenshotUrl,
          frictionDot: 'sage',
          clickPoints: [],
          rageClusters: [],
          deadClickPoints: [],
          personaPins: [],
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

      if (scr.rageClusters.length > 2) scr.frictionDot = 'coral';
      else if (scr.deadClickPoints.length > 2) scr.frictionDot = 'amber';
    }

    const screens = Array.from(screensMap.values());
    res.json({ success: true, data: screens, count: screens.length });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/runs/:id ─────────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['status', 'summary', 'scores', 'completedAt'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    const run = await Run.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    // Emit run:finished if completed
    const io = req.app.get('io');
    if (io && updates.status === 'completed') {
      io.to(`run:${run._id}`).emit('run:finished', { runId: run._id, summary: run.summary });
    }

    res.json({ success: true, data: run });
  } catch (err) {
    next(err);
  }
});

export default router;
