/**
 * server/src/routes/fixes.js
 *
 * REST endpoints for Fix Emulator:
 *
 *   GET  /api/runs/:id/fixes
 *     → List all generated fixes for a run (generate if not cached)
 *
 *   POST /api/runs/:id/fixes/preview
 *     Body: { enabledFixIds: string[], pagePath: string }
 *     → Generate before/after screenshots for the given page + fix selection
 *
 *   POST /api/runs/:id/fixes/retest
 *     Body: { enabledFixIds: string[] }
 *     → Create a patched child run and start it with injected fixes
 *
 *   GET  /api/runs/:id/fixes/export
 *     → Download fix report (markdown + code snippets)
 *
 * Safety:
 *   - All routes require auth (protect middleware)
 *   - Only owner of the run can access
 *   - ownershipVerified OR localhost required for preview/retest
 *   - Rate limited per user
 *   - All patchOps validated by fixPatcher before use
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.js';
import Run from '../models/Run.js';
import Session from '../models/Session.js';
import Step from '../models/Step.js';
import FixCache from '../models/FixCache.js';
import { generateFixes } from '../services/fixGenerator.js';
import { generatePreviewScreenshots, buildCacheKey, buildInitScriptAsync } from '../services/fixEmulator.js';
import { validatePatchOps } from '../services/fixPatcher.js';
import { runPageAudit } from '../services/pageAudit.js';
import { chromium } from 'playwright';

const router = Router({ mergeParams: true });
router.use(protect);

// Rate limit: 30 fix preview requests per 15 minutes per user
const fixRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
  message: { success: false, error: 'Too many fix preview requests. Please wait a few minutes.' },
});

// Rate limit for retest: 5 per hour
const retestRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
  message: { success: false, error: 'Too many re-test requests. Limit is 5 per hour.' },
});

// ─── Helper: verify run ownership ─────────────────────────────────────────────
async function getOwnedRun(runId, userId) {
  const run = await Run.findById(runId);
  if (!run || !run.userId.equals(userId)) return null;
  return run;
}

// ─── Helper: check if site is previewable ────────────────────────────────────
function isPreviewable(run) {
  if (!run) return false;
  const hostname = (() => {
    try { return new URL(run.url).hostname; } catch { return ''; }
  })();
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const isDev = process.env.NODE_ENV !== 'production';
  return run.ownershipVerified || isLocal || (isDev && process.env.ALLOW_UNVERIFIED_DEV === 'true');
}

// ─── GET /api/runs/:id/fixes ──────────────────────────────────────────────────
router.get('/:id/fixes', async (req, res, next) => {
  try {
    const run = await getOwnedRun(req.params.id, req.user._id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    // Return cached fixes if available
    let cache = await FixCache.findOne({ runId: run._id });
    if (cache && cache.fixes?.length > 0) {
      return res.json({
        success: true,
        data: {
          fixes: cache.fixes,
          previewable: isPreviewable(run),
          childRunId: cache.childRunId,
          generatedAt: cache.generatedAt,
        },
      });
    }

    // Generate fixes from audit findings + session data
    const sessions = await Session.find({ runId: run._id }).lean();
    const allSteps = await Step.find({ runId: run._id }).sort({ stepIndex: 1, ts: 1 }).lean();

    // Re-run page audit if we have audit data in steps, or use run.summary
    const pageAudits = run.summary?.pageAudits || [];

    // Generate fixes from run data
    const fixes = await generateFixes(run, pageAudits, sessions);

    // Cache the result
    cache = await FixCache.findOneAndUpdate(
      { runId: run._id },
      {
        runId: run._id,
        fixes,
        fixCount: fixes.length,
        previews: new Map(),
        generatedAt: new Date(),
        simulated: true,
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: {
        fixes,
        previewable: isPreviewable(run),
        childRunId: cache.childRunId,
        generatedAt: cache.generatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/runs/:id/fixes/preview ─────────────────────────────────────────
router.post('/:id/fixes/preview', fixRateLimit, async (req, res, next) => {
  try {
    const run = await getOwnedRun(req.params.id, req.user._id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    if (!isPreviewable(run)) {
      return res.status(403).json({
        success: false,
        error: 'Site ownership not verified. Add the verification meta tag or use localhost.',
      });
    }

    const { enabledFixIds = [], pagePath = '/' } = req.body;
    if (!Array.isArray(enabledFixIds)) {
      return res.status(400).json({ success: false, error: 'enabledFixIds must be an array' });
    }

    // Get cached fixes
    const cache = await FixCache.findOne({ runId: run._id });
    if (!cache || !cache.fixes?.length) {
      return res.status(404).json({
        success: false,
        error: 'No fixes generated for this run. Fetch GET /fixes first.',
      });
    }

    // Validate that requested fix ids exist and are valid
    const validFixIds = new Set(cache.fixes.map(f => f.id));
    const invalidIds = enabledFixIds.filter(id => !validFixIds.has(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Unknown fix IDs: ${invalidIds.join(', ')}`,
      });
    }

    // Check cache for this exact combination
    const cacheKey = buildCacheKey(run._id.toString(), pagePath, enabledFixIds);
    const existingPreview = cache.previews?.get(cacheKey);

    if (existingPreview?.afterUrl) {
      return res.json({ success: true, data: existingPreview, cached: true });
    }

    // Build the target URL for this page path
    const baseUrl = run.url;
    let pageUrl;
    try {
      const parsed = new URL(baseUrl);
      pageUrl = `${parsed.protocol}//${parsed.host}${pagePath}`;
    } catch {
      pageUrl = baseUrl;
    }

    // Get fixes with all patch ops re-validated
    const activeFixes = cache.fixes
      .filter(f => enabledFixIds.includes(f.id) && f.pagePath === pagePath)
      .map(fix => ({
        ...fix,
        patchOps: validatePatchOps(fix.patchOps || []), // re-validate for safety
      }));

    // Generate before/after screenshots
    const result = await generatePreviewScreenshots({
      runId: run._id.toString(),
      pageUrl,
      pagePath,
      fixes: activeFixes,
      enabledFixIds,
      device: run.device || 'desktop',
      cacheKey,
    });

    // Store in cache
    const previewData = {
      pagePath,
      pageUrl,
      cacheKey,
      beforeUrl: result.beforeUrl,
      afterUrl: result.afterUrl,
      bboxes: result.bboxes || [],
      feasible: result.feasible,
      reason: result.reason || null,
      generatedAt: new Date(),
    };

    await FixCache.findOneAndUpdate(
      { runId: run._id },
      { $set: { [`previews.${cacheKey}`]: previewData } }
    );

    res.json({ success: true, data: previewData, cached: false });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/runs/:id/fixes/retest ──────────────────────────────────────────
router.post('/:id/fixes/retest', retestRateLimit, async (req, res, next) => {
  try {
    const run = await getOwnedRun(req.params.id, req.user._id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    if (!isPreviewable(run)) {
      return res.status(403).json({
        success: false,
        error: 'Site ownership not verified. Verify your site before running simulated tests.',
      });
    }

    if (run.mode === 'patched') {
      return res.status(400).json({
        success: false,
        error: 'Cannot re-test a patched run. Use the original parent run.',
      });
    }

    const { enabledFixIds = [] } = req.body;
    if (!Array.isArray(enabledFixIds) || enabledFixIds.length === 0) {
      return res.status(400).json({ success: false, error: 'enabledFixIds must be a non-empty array' });
    }

    // Check existing cache
    const cache = await FixCache.findOne({ runId: run._id });
    if (!cache || !cache.fixes?.length) {
      return res.status(404).json({
        success: false,
        error: 'No fixes generated. Call GET /fixes first.',
      });
    }

    // Validate fix IDs
    const validFixIds = new Set(cache.fixes.map(f => f.id));
    const invalidIds = enabledFixIds.filter(id => !validFixIds.has(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Unknown fix IDs: ${invalidIds.join(', ')}`,
      });
    }

    // Get validated fixes
    const activeFixes = cache.fixes
      .filter(f => enabledFixIds.includes(f.id))
      .map(fix => ({
        ...fix,
        patchOps: validatePatchOps(fix.patchOps || []),
      }));

    // Build init script for patched child run
    const initScript = await buildInitScriptAsync(activeFixes, enabledFixIds);

    // Create child run
    const childRun = await Run.create({
      userId: req.user._id,
      url: run.url,
      goal: run.goal,
      personaCount: run.personaCount,
      device: run.device,
      selectedPersonas: run.selectedPersonas,
      ownershipVerified: run.ownershipVerified,
      verificationMethod: run.verificationMethod,
      status: 'running',
      mode: 'patched',
      simulated: true,
      parentRunId: run._id,
      enabledFixIds,
      summary: {
        schemaVersion: 2,
        totalSessions: run.personaCount || 0,
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
        isSimulated: true,
        parentRunId: run._id.toString(),
      },
    });

    // Update cache with child run reference
    await FixCache.findOneAndUpdate(
      { runId: run._id },
      { childRunId: childRun._id }
    );

    // Emit socket event for this run
    const io = req.app.get('io');
    if (io) {
      io.to(`run:${run._id}`).emit('run:retest:started', {
        parentRunId: run._id,
        childRunId: childRun._id,
        enabledFixIds,
        simulated: true,
      });
    }

    // Trigger child run execution with the init script injected
    const simulationQueue = req.app.get('simulationQueue');
    const { processAgentRun } = await import('../workers/agent.js');

    if (simulationQueue) {
      await simulationQueue.add('simulate', {
        runId: childRun._id.toString(),
        initScript,
        simulated: true,
      }, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
      });
    } else {
      // Inline execution
      processAgentRun(childRun._id, io, { initScript, simulated: true }).catch(async (err) => {
        console.error('[fixes/retest] Child run failed:', err.message);
        await Run.findByIdAndUpdate(childRun._id, {
          status: 'failed',
          'summary.errorMessage': err.message,
          completedAt: new Date(),
        });
      });
    }

    res.status(201).json({
      success: true,
      data: {
        childRunId: childRun._id,
        parentRunId: run._id,
        simulated: true,
        enabledFixIds,
        status: childRun.status,
        message: 'Patched child run started. Results are simulated and clearly labeled.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/runs/:id/fixes/export ──────────────────────────────────────────
router.get('/:id/fixes/export', async (req, res, next) => {
  try {
    const run = await getOwnedRun(req.params.id, req.user._id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    const cache = await FixCache.findOne({ runId: run._id });
    if (!cache || !cache.fixes?.length) {
      return res.status(404).json({ success: false, error: 'No fixes to export.' });
    }

    const fixes = cache.fixes;
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...fixes].sort((a, b) =>
      (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
    );

    // Build markdown report
    const lines = [
      `# Fix Report — Simulated Preview`,
      ``,
      `> ⚠️ **Simulated preview** — changes below are suggestions only and were never applied to your real website.`,
      ``,
      `**Site:** ${run.url}`,
      `**Run date:** ${new Date(run.createdAt).toLocaleDateString()}`,
      `**Personas tested:** ${run.personaCount}`,
      `**Fixes generated:** ${fixes.length}`,
      ``,
      `---`,
      ``,
    ];

    const bySeverity = {};
    for (const fix of sorted) {
      if (!bySeverity[fix.severity]) bySeverity[fix.severity] = [];
      bySeverity[fix.severity].push(fix);
    }

    for (const severity of ['critical', 'high', 'medium', 'low']) {
      const group = bySeverity[severity];
      if (!group?.length) continue;

      lines.push(`## ${severity.charAt(0).toUpperCase() + severity.slice(1)} Priority`);
      lines.push('');

      for (const fix of group) {
        lines.push(`### ☐ ${fix.title}`);
        lines.push('');
        lines.push(`**Page:** \`${fix.pagePath}\``);
        lines.push(`**Problem:** ${fix.problem}`);
        lines.push(`**Personas affected:** ${fix.evidence?.personasAffected ?? '?'}`);
        lines.push(`**Effort:** ${fix.effort} · **Confidence:** ${Math.round((fix.confidence || 0) * 100)}%`);
        lines.push(`**Expected impact:** ${fix.expectedImpact}`);
        lines.push('');
        lines.push('**Code fix:**');
        lines.push('```');
        lines.push(fix.codeSnippet || '// See patch ops');
        lines.push('```');
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('## CSS Patch (apply all fixes)');
    lines.push('');
    lines.push('```css');

    // Collect all setStyle ops into a CSS snippet
    const cssRules = {};
    for (const fix of sorted) {
      for (const op of (fix.patchOps || [])) {
        if (op.type === 'setStyle' && op.cssProps) {
          if (!cssRules[op.selector]) cssRules[op.selector] = {};
          Object.assign(cssRules[op.selector], op.cssProps);
        }
      }
    }
    for (const [sel, props] of Object.entries(cssRules)) {
      lines.push(`${sel} {`);
      for (const [prop, val] of Object.entries(props)) {
        // Convert camelCase to kebab-case
        const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        lines.push(`  ${kebab}: ${val};`);
      }
      lines.push('}');
      lines.push('');
    }

    lines.push('```');
    lines.push('');
    lines.push(`*Generated by Personify Fix Emulator — ${new Date().toISOString()}*`);

    const markdown = lines.join('\n');

    res.set('Content-Type', 'text/markdown; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="fix-report-${run._id}.md"`);
    res.send(markdown);
  } catch (err) {
    next(err);
  }
});

// ─── Export for mounting ──────────────────────────────────────────────────────
// Usage in runs.js: router.use('/:id', fixesRouter) — note the :id is re-bound
export default router;
