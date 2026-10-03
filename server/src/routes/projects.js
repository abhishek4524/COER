import express from 'express';
import { protect } from '../middleware/auth.js';
import { Project } from '../models/Project.js';
import { Run } from '../models/Run.js';

const router = express.Router();
router.use(protect);

// GET /api/projects - list projects with calculated trends
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user._id }).sort({ updatedAt: -1 }).lean();

    // Fetch user runs to sync statistics for each domain
    const userRuns = await Run.find({ userId: req.user._id }).select('targetUrl status aggregateMetrics createdAt').lean();

    const populated = projects.map((p) => {
      const domainRuns = userRuns.filter((r) => {
        try {
          const url = r.targetUrl.startsWith('http') ? r.targetUrl : `https://${r.targetUrl}`;
          return new URL(url).hostname.replace(/^www\./, '').toLowerCase() === p.domain.replace(/^www\./, '').toLowerCase();
        } catch {
          return false;
        }
      });

      const completed = domainRuns.filter((r) => r.status === 'completed');
      const latestRun = completed.length > 0
        ? completed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        : null;

      const bestRate = completed.reduce((max, r) => {
        const rate = r.aggregateMetrics?.taskCompletionRate ?? 0;
        return rate > max ? rate : max;
      }, 0);

      const latestFriction = latestRun?.aggregateMetrics?.overallFrictionScore ?? 0;

      return {
        ...p,
        runCount: domainRuns.length,
        lastTestedAt: latestRun ? latestRun.createdAt : p.lastTestedAt,
        bestSuccessRate: Math.round(bestRate),
        latestFrictionScore: Math.round(latestFriction * 10) / 10,
      };
    });

    res.json({ projects: populated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects - create new project
router.post('/', async (req, res) => {
  try {
    const { name, domain, defaultGoal, defaultPersonaGroup, defaultDevice } = req.body;
    if (!name || !domain) {
      return res.status(400).json({ error: 'Name and domain are required' });
    }

    let cleanDomain = domain.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');

    const existing = await Project.findOne({ userId: req.user._id, domain: cleanDomain });
    if (existing) {
      return res.status(400).json({ error: 'A project for this domain already exists' });
    }

    const project = await Project.create({
      userId: req.user._id,
      name: name.trim(),
      domain: cleanDomain,
      defaultGoal: defaultGoal || 'Test overall user experience and find conversion friction',
      defaultPersonaGroup: defaultPersonaGroup || 'all',
      defaultDevice: defaultDevice || 'desktop',
    });

    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:id - update project
router.patch('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { name, defaultGoal, defaultPersonaGroup, defaultDevice } = req.body;
    if (name) project.name = name.trim();
    if (defaultGoal) project.defaultGoal = defaultGoal;
    if (defaultPersonaGroup) project.defaultPersonaGroup = defaultPersonaGroup;
    if (defaultDevice) project.defaultDevice = defaultDevice;

    await project.save();
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id - delete project
router.delete('/:id', async (req, res) => {
  try {
    const result = await Project.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
