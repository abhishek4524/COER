/**
 * server/src/workers/agent.js
 *
 * Persona agent loop: Playwright + LLM.
 *
 * runPersonaSession(job, io) is called by BullMQ for each persona session.
 * job.data = { runId, sessionId, personaId, goal, url, device, viewportConfig }
 *
 * The loop:
 *   1. Launch Playwright chromium with persona viewport + optional network throttling
 *   2. Loop max 15 steps:
 *      a. Extract simplified page state
 *      b. Call LLM → JSON action
 *      c. Execute action in Playwright
 *      d. Take screenshot, save Step, emit socket event
 *      e. Break on goal_complete / give_up / max steps
 *   3. Ask persona for final feedback review
 *   4. Run aggregator friction detection
 *   5. Update Session + Run docs
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import Session from '../models/Session.js';
import Step from '../models/Step.js';
import Run from '../models/Run.js';
import Persona from '../models/Persona.js';
import { callLLM, buildPageStatePrompt, buildSummaryPrompt, SUMMARY_SCHEMA } from '../services/llm.js';
import { detectFriction } from '../services/aggregator.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_STEPS = 15;
const ACTION_TIMEOUT_MS = 2500; // fast timeout per element locator attempt
const PAGE_LOAD_TIMEOUT = 10_000;
const SCREENSHOT_DIR = path.resolve('screenshots');

// Ensure screenshot dir exists
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ─── Viewport configs ────────────────────────────────────────────────────────

const VIEWPORTS = {
  desktop:  { width: 1440, height: 900 },
  mobile:   { width: 390, height: 844 },
  slow:     { width: 390, height: 844 },  // mobile + throttling
};

// Chrome DevTools Protocol network conditions for "Slow 3G"
const SLOW_NETWORK = {
  offline: false,
  downloadThroughput: (500 * 1024) / 8,   // 500 Kbps
  uploadThroughput:   (500 * 1024) / 8,
  latency: 400,
};

// ─── Page state extraction ────────────────────────────────────────────────────

async function extractPageState(page) {
  const url = page.url();
  const title = await page.title().catch(() => '');

  // Visible text (first 1000 chars)
  const visibleText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const chunks = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text && text.length > 1) chunks.push(text);
      if (chunks.join(' ').length > 1000) break;
    }
    return chunks.join(' ');
  }).catch(() => '');

  // Interactive elements
  const elements = await page.evaluate(() => {
    const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio',
      'combobox', 'listbox', 'menuitem', 'tab', 'switch'];
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];

    const seen = new Set();
    const results = [];

    function process(el) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // invisible
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

      // Build a unique key
      const key = `${el.tagName}|${rect.x.toFixed(0)}|${rect.y.toFixed(0)}`;
      if (seen.has(key)) return;
      seen.add(key);

      const role = el.getAttribute('role')
        || (el.tagName === 'A' ? 'link'
          : el.tagName === 'BUTTON' ? 'button'
          : el.tagName === 'INPUT' ? (el.type || 'textbox')
          : el.tagName === 'SELECT' ? 'combobox'
          : el.tagName === 'TEXTAREA' ? 'textbox'
          : el.tagName.toLowerCase());

      const name = el.getAttribute('aria-label')
        || el.getAttribute('placeholder')
        || el.getAttribute('title')
        || el.textContent?.trim().slice(0, 60)
        || el.getAttribute('name')
        || '';

      // Build a reliable selector
      let selector = '';
      if (el.id) selector = `#${el.id}`;
      else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
      else if (el.getAttribute('name')) selector = `[name="${el.getAttribute('name')}"]`;
      else if (el.className) selector = `.${el.className.trim().split(/\s+/)[0]}`;
      else selector = el.tagName.toLowerCase();

      const fontSize = parseFloat(style.fontSize) || 16;

      results.push({
        role,
        name: name.trim(),
        selector,
        bbox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
        fontSize: Math.round(fontSize),
        tag: el.tagName.toLowerCase(),
      });
    }

    // Query both by tag and ARIA role
    interactiveTags.forEach((tag) =>
      document.querySelectorAll(tag).forEach(process)
    );
    interactiveRoles.forEach((role) =>
      document.querySelectorAll(`[role="${role}"]`).forEach(process)
    );

    return results.slice(0, 50); // cap
  }).catch(() => []);

  return { url, title, visibleText, elements };
}

// ─── Action execution ─────────────────────────────────────────────────────────

async function executeAction(page, action) {
  const { action: type, target, text } = action;
  let x = null, y = null, domChanged = false;

  const urlBefore = page.url();

  switch (type) {
    case 'click': {
      let clicked = false;
      if (target) {
        // Strategy 1: Direct CSS selector
        try {
          const el = page.locator(target).first();
          const box = await el.boundingBox({ timeout: 1200 });
          if (box) {
            x = Math.round(box.x + box.width / 2);
            y = Math.round(box.y + box.height / 2);
            await el.click({ timeout: ACTION_TIMEOUT_MS });
            clicked = true;
          }
        } catch {}

        // Strategy 2: Button by name/label
        if (!clicked) {
          try {
            const el = page.getByRole('button', { name: target, exact: false }).first();
            const box = await el.boundingBox({ timeout: 1200 });
            if (box) {
              x = Math.round(box.x + box.width / 2);
              y = Math.round(box.y + box.height / 2);
            }
            await el.click({ timeout: ACTION_TIMEOUT_MS });
            clicked = true;
          } catch {}
        }

        // Strategy 3: Link by name/label
        if (!clicked) {
          try {
            const el = page.getByRole('link', { name: target, exact: false }).first();
            const box = await el.boundingBox({ timeout: 1200 });
            if (box) {
              x = Math.round(box.x + box.width / 2);
              y = Math.round(box.y + box.height / 2);
            }
            await el.click({ timeout: ACTION_TIMEOUT_MS });
            clicked = true;
          } catch {}
        }

        // Strategy 4: Exact or partial text match
        if (!clicked) {
          try {
            const el = page.getByText(target, { exact: false }).first();
            const box = await el.boundingBox({ timeout: 1200 });
            if (box) {
              x = Math.round(box.x + box.width / 2);
              y = Math.round(box.y + box.height / 2);
            }
            await el.click({ timeout: ACTION_TIMEOUT_MS });
            clicked = true;
          } catch {}
        }

        // Strategy 5: If nothing matched, click fallback coordinates or center of viewport
        if (!clicked && x == null) {
          x = 640;
          y = 360;
          await page.mouse.click(x, y).catch(() => {});
        }
      }
      domChanged = page.url() !== urlBefore;
      break;
    }

    case 'type': {
      if (target) {
        let typed = false;
        try {
          const el = page.locator(target).first();
          await el.click({ timeout: 1200 });
          await el.fill(text || '', { timeout: ACTION_TIMEOUT_MS });
          typed = true;
        } catch {}

        if (!typed) {
          try {
            const el = page.getByPlaceholder(target, { exact: false }).first();
            await el.click({ timeout: 1200 });
            await el.fill(text || '', { timeout: ACTION_TIMEOUT_MS });
            typed = true;
          } catch {}
        }

        if (!typed) {
          try {
            await page.keyboard.type(text || '');
            typed = true;
          } catch {}
        }
        domChanged = typed;
      }
      break;
    }

    case 'scroll': {
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(200);
      break;
    }

    case 'wait': {
      await page.waitForTimeout(500);
      break;
    }

    case 'give_up':
    case 'goal_complete':
      break;

    default:
      console.warn(`[agent] Unknown action: ${type}`);
  }

  // Wait briefly for DOM or navigation settlement
  await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {});

  return { x, y, domChanged, urlAfter: page.url() };
}

// ─── Screenshot helper ────────────────────────────────────────────────────────

async function takeScreenshot(page, runId, stepIndex) {
  const filename = `${runId}_step${stepIndex}_${Date.now()}.png`;
  const filePath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filePath, type: 'png', fullPage: false }).catch(() => {});
  return `/screenshots/${filename}`;
}

// ─── Main persona session runner ──────────────────────────────────────────────

export async function runPersonaSession(job, io) {
  const { runId, sessionId, personaId, goal, url, device } = job.data;

  console.log(`[agent] Starting session ${sessionId} | persona ${personaId} | run ${runId}`);

  const persona = await Persona.findById(personaId);
  if (!persona) throw new Error(`Persona ${personaId} not found`);

  const session = await Session.findById(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const viewport = VIEWPORTS[device] || VIEWPORTS.desktop;
  const isMobile = device === 'mobile' || device === 'slow';

  // ── Launch browser ──────────────────────────────────────────────────────────
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport,
    userAgent: isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    locale: persona.traits?.language === 'hi' ? 'hi-IN' : 'en-US',
    ignoreHTTPSErrors: true,
  });

  // Apply network throttling for slow-network device
  if (device === 'slow') {
    const cdp = await context.newCDPSession(await context.newPage());
    await cdp.send('Network.emulateNetworkConditions', SLOW_NETWORK);
    await cdp.detach();
  }

  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);

  const stepHistory = [];
  let stepIndex = 0;
  let outcome = 'in_progress';
  let clickCount = 0;
  let rageClickCount = 0;
  const startTime = Date.now();

  const targetUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    // Navigate to URL (gracefully handle slow or heavy real sites)
    try {
      await page.goto(targetUrl, { waitUntil: 'commit', timeout: 20_000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    } catch (navErr) {
      console.warn(`[agent] Navigation notice for ${targetUrl}:`, navErr.message);
    }

    // ── Step loop ────────────────────────────────────────────────────────────
    while (stepIndex < MAX_STEPS) {
      // a. Extract page state
      const pageState = await extractPageState(page);
      pageState.url = page.url();

      // b. Build prompt + call LLM
      const last5 = stepHistory.slice(-5);
      const userPrompt = buildPageStatePrompt(pageState, persona, goal, last5);

      let llmAction;
      try {
        llmAction = await callLLM(persona.systemPrompt, userPrompt);
      } catch (llmErr) {
        console.error(`[agent] LLM error on step ${stepIndex}:`, llmErr.message);
        llmAction = {
          action: 'give_up',
          target: null,
          text: null,
          thought: 'I am confused and cannot proceed.',
          emotion: 'frustrated',
          frustration: 8,
        };
      }

      // Validate required fields
      if (!llmAction.action) llmAction.action = 'wait';
      llmAction.frustration = Math.min(10, Math.max(0, Number(llmAction.frustration) || 0));

      // c. Execute action + take screenshot
      const { x, y, domChanged, urlAfter } = await executeAction(page, llmAction).catch((err) => {
        console.warn(`[agent] Execute error step ${stepIndex}:`, err.message);
        return { x: null, y: null, domChanged: false, urlAfter: page.url() };
      });

      const screenshotUrl = await takeScreenshot(page, runId, stepIndex);

      // Track click counts
      if (llmAction.action === 'click') clickCount++;

      // Check if it was a rage-click (frustration ≥ 7 + click)
      const isRageClick = llmAction.action === 'click' && llmAction.frustration >= 7;
      if (isRageClick) rageClickCount++;

      // d. Save Step to DB
      const step = await Step.create({
        sessionId,
        runId,
        stepIndex,
        action: isRageClick ? 'rage_click' : llmAction.action,
        target: llmAction.target,
        x,
        y,
        viewport,
        thought: llmAction.thought,
        emotion: llmAction.emotion,
        frustration: llmAction.frustration * 10, // normalize to 0-100 for DB
        screenshotUrl,
        isDeadClick: llmAction.action === 'click' && !domChanged && urlAfter === pageState.url,
        domChanged,
        url: pageState.url,
        pageTitle: pageState.title,
        personaName: persona.name,
        ts: new Date(),
      }).catch((err) => {
        console.error('[agent] Step save error:', err.message);
        return null;
      });

      // Push to history for LLM context
      stepHistory.push({
        action: llmAction.action,
        target: llmAction.target,
        thought: llmAction.thought,
        emotion: llmAction.emotion,
        frustration: llmAction.frustration,
        url: pageState.url,
      });

      // e. Emit socket event
      if (io) {
        io.to(`run:${runId}`).emit('step', {
          sessionId,
          personaName: persona.name,
          personaAvatar: persona.avatarSet?.default,
          stepIndex,
          action: llmAction.action,
          x, y,
          thought: llmAction.thought,
          emotion: llmAction.emotion,
          frustration: llmAction.frustration,
          screenshotUrl,
          url: pageState.url,
        });

        io.to(`run:${runId}`).emit('emotion', {
          sessionId,
          personaName: persona.name,
          emotion: llmAction.emotion,
          frustration: llmAction.frustration,
        });
      }

      stepIndex++;

      // f. Stop conditions
      if (llmAction.action === 'goal_complete') {
        outcome = 'completed';
        console.log(`[agent] ✅ ${persona.name} completed goal at step ${stepIndex}`);
        break;
      }
      if (llmAction.action === 'give_up') {
        outcome = 'gave_up';
        console.log(`[agent] ❌ ${persona.name} gave up at step ${stepIndex}`);
        break;
      }
    }

    if (outcome === 'in_progress') {
      // Hit max steps
      outcome = 'gave_up';
      console.log(`[agent] ⏰ ${persona.name} hit max steps (${MAX_STEPS})`);
    }

    // 3. Ask for final feedback
    let finalFeedback = '';
    try {
      const feedbackPrompt = `You are ${persona.name}. You just tested this website with the goal: "${goal}".
The outcome was: ${outcome}.
Your steps: ${stepHistory.map((h, i) => `${i + 1}. [${h.action}] ${h.thought}`).join('\n')}

Write a short 2-3 sentence first-person review of your experience. Be authentic to your persona's voice and tech level.`;

      finalFeedback = await callLLM(persona.systemPrompt, feedbackPrompt, { freeText: true });
    } catch (err) {
      finalFeedback = outcome === 'completed'
        ? 'I managed to complete the task, though some steps were confusing.'
        : 'I could not complete the task. The interface was too confusing for me.';
    }

    // 4. Run friction detection on this session's steps
    const allSteps = await Step.find({ sessionId }).lean();
    const friction = detectFriction(allSteps);

    // 5. Update Session
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const avgFrustration = allSteps.length
      ? Math.round(allSteps.reduce((s, st) => s + (st.frustration || 0), 0) / allSteps.length)
      : 0;

    await Session.findByIdAndUpdate(sessionId, {
      outcome,
      totalTime,
      frustrationScore: avgFrustration,
      finalFeedback,
      clickCount,
      rageClickCount,
      missedCTA: friction.deadClicks.length > 0,
    });

    if (io) {
      io.to(`run:${runId}`).emit('session:finished', {
        sessionId,
        personaName: persona.name,
        outcome,
        frustrationScore: avgFrustration,
        finalFeedback,
      });
    }

    console.log(`[agent] Session ${sessionId} done | ${persona.name} | outcome=${outcome} | steps=${stepIndex} | time=${totalTime}s`);

    return { sessionId, personaName: persona.name, outcome, totalTime, avgFrustration, finalFeedback };

  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── Run orchestrator (called by BullMQ) ─────────────────────────────────────

/**
 * Process an entire run: create sessions for all personas, queue them,
 * run in batches (concurrency = process.env.AGENT_CONCURRENCY || 5),
 * then aggregate and write final summary.
 */
export async function processAgentRun(runId, io) {
  const run = await Run.findById(runId);
  if (!run) throw new Error(`Run ${runId} not found`);

  await Run.findByIdAndUpdate(runId, { status: 'running' });
  io?.to(`run:${runId}`).emit('run:started', { runId, personaCount: run.personaCount });

  // Pick personas from DB (random selection)
  const personas = await Persona.find().limit(run.personaCount).lean();
  if (!personas.length) throw new Error('No personas found. Run `npm run seed` first.');

  const concurrency = Number(process.env.AGENT_CONCURRENCY) || 5;
  const sessionResults = [];

  // Process in concurrency batches
  for (let i = 0; i < personas.length; i += concurrency) {
    const batch = personas.slice(i, i + concurrency);

    const batchPromises = batch.map(async (persona) => {
      // Create session
      const session = await Session.create({
        runId,
        personaId: persona._id,
        personaSnapshot: {
          name: persona.name,
          age: persona.age,
          tag: persona.traits?.ageGroup || 'unknown',
          traits: persona.traits,
          avatarSet: persona.avatarSet,
        },
        outcome: 'in_progress',
      });

      io?.to(`run:${runId}`).emit('session:started', {
        sessionId: session._id,
        personaName: persona.name,
        personaAvatar: persona.avatarSet?.default,
      });

      // Run as a fake BullMQ job
      const fakeJob = {
        data: {
          runId,
          sessionId: session._id.toString(),
          personaId: persona._id.toString(),
          goal: run.goal,
          url: run.url,
          device: run.device || 'desktop',
        },
      };

      try {
        const result = await runPersonaSession(fakeJob, io);
        return result;
      } catch (err) {
        console.error(`[agent] Session failed for ${persona.name}:`, err.message);
        await Session.findByIdAndUpdate(session._id, {
          outcome: 'gave_up',
          finalFeedback: 'Session failed due to an error.',
        });
        return { sessionId: session._id, personaName: persona.name, outcome: 'gave_up', error: err.message };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    sessionResults.push(...batchResults);
  }

  // ── Final summary LLM call ────────────────────────────────────────────────
  let topIssues = [];
  try {
    const sessions = await Session.find({ runId }).lean();
    const feedbacks = sessions.map((s) => ({
      personaName: s.personaSnapshot?.name || 'Unknown',
      outcome: s.outcome,
      feedback: s.finalFeedback || '',
    })).filter((f) => f.feedback);

    if (feedbacks.length > 0) {
      const summarySystemPrompt = 'You are a senior UX researcher analyzing usability test results. Provide structured, actionable insights.';
      const summaryUserPrompt = buildSummaryPrompt(feedbacks, run.goal, run.url);
      topIssues = await callLLM(summarySystemPrompt, summaryUserPrompt, { schema: SUMMARY_SCHEMA });
    }
  } catch (err) {
    console.warn('[agent] Summary LLM call failed:', err.message);
    topIssues = [{
      title: 'Unable to generate AI summary',
      severity: 'low',
      affectedCount: 0,
      description: 'The LLM summary step failed. See individual session feedback.',
      suggestedFix: 'Review individual persona feedback manually.',
    }];
  }

  // ── Aggregate metrics ─────────────────────────────────────────────────────
  const { buildRunMetrics, buildPerPersonaTypeScores, buildDropOffFunnel } = await import('../services/aggregator.js');
  const sessions = await Session.find({ runId }).lean();
  const allSteps = await (await import('../models/Step.js')).default.find({ runId }).lean();
  const sessionsWithSteps = sessions.map((s) => ({
    ...s,
    steps: allSteps.filter((st) => st.sessionId?.toString() === s._id?.toString()),
  }));

  const metrics = buildRunMetrics(sessionsWithSteps);
  const personaTypeScores = buildPerPersonaTypeScores(sessions);
  const funnel = buildDropOffFunnel(sessionsWithSteps);

  // ── Update Run with final summary ─────────────────────────────────────────
  const summary = {
    ...metrics,
    topIssues,
    personaTypeScores,
    funnel,
  };

  await Run.findByIdAndUpdate(runId, {
    status: 'completed',
    summary,
    scores: {
      taskSuccessRate: metrics.taskSuccessRate,
      avgFrustration: metrics.avgFrustration,
      ctaMissRate: metrics.ctaMissRate,
      avgSessionTime: metrics.avgSessionTime,
    },
    completedAt: new Date(),
  });

  io?.to(`run:${runId}`).emit('run:finished', { runId, summary });

  console.log(`[agent] ✅ Run ${runId} complete. Success: ${metrics.taskSuccessRate}% | Issues: ${topIssues.length}`);
  return summary;
}
