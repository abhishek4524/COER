import { Router } from 'express';
import Session from '../models/Session.js';
import Step from '../models/Step.js';

const router = Router();

// GET /api/sessions
router.get('/', async (req, res, next) => {
  try {
    const { personaId, runId, limit = 50 } = req.query;
    const filter = {};
    if (personaId) filter.personaId = personaId;
    if (runId) filter.runId = runId;

    const sessions = await Session.find(filter)
      .populate('personaId', 'name age traits avatarSet')
      .populate('runId', 'url goal status')
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    res.json({ success: true, data: sessions, count: sessions.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('personaId', 'name age traits avatarSet')
      .populate('runId', 'url goal status');
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id/steps
router.get('/:id/steps', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    const steps = await Step.find({ sessionId: req.params.id }).sort({ stepIndex: 1, ts: 1 });
    res.json({ success: true, data: steps, count: steps.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/steps  (for worker to push steps)
router.post('/:id/steps', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    const step = await Step.create({ ...req.body, sessionId: req.params.id, runId: session.runId });
    res.status(201).json({ success: true, data: step });
  } catch (err) {
    next(err);
  }
});

export default router;
