/**
 * server/src/workers/agent.js
 *
 * Robust Persona Agent Loop with Playwright + LLM:
 * - CDP screencast per session (thumbnail 1fps room-wide, full 6fps to watchers)
 * - action:planned + action:result rich events for Live Preview overlay
 * - Realistic curved mouse movement before clicks
 * - Element-index based action execution (no CSS selector hallucination)
 * - Real bounding-box center click detection (NO fallback to viewport center)
 * - Dead click detection, SPA network idle, hydration wait
 * - Loop detection and action repetition prevention
 * - Automated page audit (axe-core, font size, tap targets, labels)
 * - Grounded insights post-check
 * - Strict 120s per-session timeout and guaranteed run lifecycle finalization
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import Session from '../models/Session.js';
import Step from '../models/Step.js';
import Run from '../models/Run.js';
import Persona from '../models/Persona.js';
import {
  callLLM,
  buildPageStatePrompt,
  buildSummaryPrompt,
  filterAndGroundedIssues,
  normalizeActionOutput,
  SUMMARY_SCHEMA,
} from '../services/llm.js';
import {
  detectFriction,
  buildRunMetrics,
  buildPerPersonaTypeScores,
  buildDropOffFunnel,
  detectPrimaryCTA,
} from '../services/aggregator.js';
import { runPageAudit } from '../services/pageAudit.js';

// ─── Constants & Setup ────────────────────────────────────────────────────────

const MAX_STEPS = 15;
const ACTION_TIMEOUT_MS = 2500;
const SESSION_TIMEOUT_MS = 120_000;
const SCREENSHOT_DIR = path.resolve('screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile:  { width: 390, height: 844 },
  slow:    { width: 390, height: 844 },
};

const SLOW_NETWORK = {
  offline: false,
  downloadThroughput: (500 * 1024) / 8,
  uploadThroughput:   (500 * 1024) / 8,
  latency: 400,
};

// Screencast config (tunable)
const THUMB_QUALITY = 40;     // jpeg quality for thumbnails
const THUMB_MAX_WIDTH = 320;
const FULL_QUALITY = 55;      // jpeg quality for full stream
const FULL_MAX_WIDTH = 960;
const THUMB_EVERY_N = 8;      // ~1fps at typical Playwright frame rate
const FULL_EVERY_N = 1;       // ~6fps for full stream

// ─── Shared Browser Instance ──────────────────────────────────────────────────

let _sharedBrowser = null;

async function getSharedBrowser() {
  if (!_sharedBrowser || !_sharedBrowser.isConnected()) {
    _sharedBrowser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }
  return _sharedBrowser;
}

// ─── Page State & Element Extraction ─────────────────────────────────────────

async function extractPageState(page) {
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(400);

  const url = page.url();
  const title = await page.title().catch(() => '');

  const visibleText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const chunks = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text && text.length > 2) {
        const parent = node.parentElement;
        if (!['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent?.tagName)) {
          chunks.push(text);
        }
      }
    }
    return chunks.slice(0, 120).join(' ');
  }).catch(() => '');

  // 3. Extract visible interactive elements & tag with data-vibetest-idx
  const elements = await page.evaluate(() => {
    // Clean old indices first
    document.querySelectorAll('[data-vibetest-idx]').forEach((el) => {
      el.removeAttribute('data-vibetest-idx');
    });

    const selector = [
      'a[href]', 'button', 'input', 'select', 'textarea',
      '[role="button"]', '[role="link"]', '[role="checkbox"]',
      '[role="radio"]', '[role="combobox"]', '[role="tab"]',
      '[role="menuitem"]', '[tabindex="0"]',
    ].join(',');

    const found = document.querySelectorAll(selector);
    const results = [];
    let idx = 1;

    found.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 2 || rect.height <= 2) return;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      const name = (
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.getAttribute('title') ||
        el.textContent?.trim().slice(0, 70) ||
        el.getAttribute('name') ||
        el.getAttribute('value') ||
        ''
      ).replace(/\s+/g, ' ').trim();

      const fontSize = parseFloat(style.fontSize) || 16;

      el.setAttribute('data-vibetest-idx', String(idx));

      results.push({
        index: idx,
        tag: el.tagName.toLowerCase(),
        role,
        name,
        fontSize: Math.round(fontSize),
        bbox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
      });

      idx++;
    });

    return results.slice(0, 35);
  }).catch(() => []);

  const domSnapshot = await page.evaluate(() => {
    return document.body ? document.body.innerText.slice(0, 400) : '';
  }).catch(() => '');

  return { url, title, visibleText, elements, domSnapshot };
}

// ─── Realistic Mouse Movement ────────────────────────────────────────────────

async function moveMouseNaturally(page, toX, toY, techSavviness = 5) {
  // Get current mouse position via CDP or default to center
  const vp = page.viewportSize() || { width: 1440, height: 900 };
  const fromX = vp.width / 2;
  const fromY = vp.height / 2;

  const steps = 12;
  // Slight S-curve via a control point offset
  const cpX = (fromX + toX) / 2 + (Math.random() - 0.5) * 60;
  const cpY = (fromY + toY) / 2 + (Math.random() - 0.5) * 40;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Quadratic Bezier
    const x = Math.round((1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * cpX + t * t * toX);
    const y = Math.round((1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * cpY + t * t * toY);
    await page.mouse.move(x, y);
    // Slower movement for less tech-savvy users
    const delay = Math.max(8, Math.round((10 - techSavviness) * 5 + Math.random() * 10));
    await page.waitForTimeout(delay);
  }
}

// ─── Action Execution ────────────────────────────────────────────────────────

async function executeAction(page, actionObj, elements = [], techSavviness = 5) {
  const { action: type, elementIndex, text } = actionObj;
  let x = null;
  let y = null;
  let clicked = false;
  let domChanged = false;
  const urlBefore = page.url();
  const snapshotBefore = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 400) : '').catch(() => '');

  switch (type) {
    case 'click': {
      if (elementIndex != null) {
        try {
          const locator = page.locator(`[data-vibetest-idx="${elementIndex}"]`).first();
          await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
          const box = await locator.boundingBox({ timeout: 1500 });

          if (box && box.width > 0 && box.height > 0) {
            x = Math.round(box.x + box.width / 2);
            y = Math.round(box.y + box.height / 2);
            // Move mouse naturally before clicking
            await moveMouseNaturally(page, x, y, techSavviness);
            await locator.click({ timeout: ACTION_TIMEOUT_MS });
            clicked = true;
          }
        } catch (clickErr) {
          console.warn(`[agent] Click on element [${elementIndex}] failed:`, clickErr.message);
        }
      }

      if (!clicked) {
        return {
          actionExecuted: 'failed_action',
          x: null,
          y: null,
          domChanged: false,
          isDeadClick: false,
          urlAfter: page.url(),
        };
      }
      break;
    }

    case 'type': {
      if (elementIndex != null) {
        try {
          const locator = page.locator(`[data-vibetest-idx="${elementIndex}"]`).first();
          await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
          const box = await locator.boundingBox({ timeout: 1500 }).catch(() => null);
          if (box) {
            x = Math.round(box.x + box.width / 2);
            y = Math.round(box.y + box.height / 2);
            await moveMouseNaturally(page, x, y, techSavviness);
          }
          await locator.click({ timeout: 1200 }).catch(() => {});
          await locator.fill(text || '', { timeout: ACTION_TIMEOUT_MS });
          domChanged = true;
        } catch (typeErr) {
          console.warn(`[agent] Fill on element [${elementIndex}] failed:`, typeErr.message);
        }
      }
      break;
    }

    case 'scroll': {
      await page.evaluate(() => window.scrollBy({ top: 450, behavior: 'smooth' }));
      await page.waitForTimeout(400);
      domChanged = true;
      break;
    }

    case 'wait': {
      await page.waitForTimeout(800);
      break;
    }

    case 'give_up':
    case 'goal_complete':
      break;

    default:
      console.warn(`[agent] Unknown action: ${type}`);
  }

  await page.waitForTimeout(500);
  const urlAfter = page.url();
  const snapshotAfter = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 400) : '').catch(() => '');

  if (urlAfter !== urlBefore || snapshotAfter !== snapshotBefore) {
    domChanged = true;
  }

  const isDeadClick = clicked && !domChanged && urlAfter === urlBefore;

  return {
    actionExecuted: type,
    x,
    y,
    domChanged,
    isDeadClick,
    urlAfter,
  };
}

// ─── Screenshot helper ────────────────────────────────────────────────────────

const SERVER_PORT = process.env.PORT || 5000;
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${SERVER_PORT}`;

async function takeScreenshot(page, runId, stepIndex) {
  const filename = `${runId}_step${stepIndex}_${Date.now()}.png`;
  const filePath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filePath, type: 'png', fullPage: false }).catch(() => {});
  return `${SERVER_BASE_URL}/screenshots/${filename}`;
}

// ─── CDP Screencast Helper ────────────────────────────────────────────────────

async function startScreencast(page, sessionId, runId, io) {
  let cdp = null;
  let thumbFrameCount = 0;
  let fullFrameCount = 0;
  let stopped = false;

  try {
    cdp = await page.context().newCDPSession(page);
  } catch (err) {
    console.warn(`[screencast:${sessionId}] Could not create CDP session:`, err.message);
    return () => {}; // return no-op stopper
  }

  const handleFrame = async (event) => {
    if (stopped) return;
    try {
      // Always ack the frame to keep stream flowing
      await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
    } catch {}

    if (!io) return;

    thumbFrameCount++;
    // Thumbnail: every Nth frame → ~1fps → emit to whole run room
    if (thumbFrameCount % THUMB_EVERY_N === 0) {
      io.to(`run:${runId}`).emit('frame:thumb', {
        sessionId,
        jpegBase64: event.data,
        ts: event.metadata?.timestamp || Date.now(),
      });
    }

    // Full quality: only for watching sockets → check watcher set
    const watchers = io._sessionWatchers?.get(sessionId);
    if (watchers && watchers.size > 0) {
      fullFrameCount++;
      if (fullFrameCount % FULL_EVERY_N === 0) {
        // Only emit to watchers (by socket id)
        for (const socketId of watchers) {
          const sock = io.sockets.sockets.get(socketId);
          if (sock && !sock.disconnected) {
            // Skip if socket is backpressured
            if (sock.conn?.transport?.writable !== false) {
              sock.emit('frame:full', {
                sessionId,
                jpegBase64: event.data,
                ts: event.metadata?.timestamp || Date.now(),
              });
            }
          }
        }
      }
    }
  };

  try {
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: FULL_QUALITY, // full quality, we'll use thumbs for room
      maxWidth: FULL_MAX_WIDTH,
      maxHeight: 720,
      everyNthFrame: 2,
    });
    cdp.on('Page.screencastFrame', handleFrame);
    console.log(`[screencast:${sessionId}] Started`);
  } catch (err) {
    console.warn(`[screencast:${sessionId}] Failed to start:`, err.message);
    return () => {};
  }

  // Return stopper function
  return async () => {
    if (stopped) return;
    stopped = true;
    try {
      cdp.off('Page.screencastFrame', handleFrame);
      await cdp.send('Page.stopScreencast').catch(() => {});
      await cdp.detach().catch(() => {});
      console.log(`[screencast:${sessionId}] Stopped`);
    } catch {}
  };
}

// ─── Single Persona Session Runner ────────────────────────────────────────────

export async function runPersonaSession(data, io, sharedBrowser) {
  const { runId, sessionId, personaId, goal, url, device } = data;

  const persona = await Persona.findById(personaId);
  if (!persona) throw new Error(`Persona ${personaId} not found`);

  const session = await Session.findById(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const viewport = VIEWPORTS[device] || VIEWPORTS.desktop;
  const isMobile = device === 'mobile' || device === 'slow';
  const techSavviness = persona.traits?.techSavviness ?? 5;

  const browser = sharedBrowser || await getSharedBrowser();
  const context = await browser.newContext({
    viewport,
    userAgent: isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    locale: persona.traits?.language === 'hi' ? 'hi-IN' : 'en-US',
    ignoreHTTPSErrors: true,
  });

  if (device === 'slow') {
    const cdp = await context.newCDPSession(await context.newPage());
    await cdp.send('Network.emulateNetworkConditions', SLOW_NETWORK);
    await cdp.detach();
  }

  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);

  // Emit session:started with viewport info
  if (io) {
    io.to(`run:${runId}`).emit('session:started', {
      sessionId,
      personaName: persona.name,
      personaAvatar: persona.avatarSet?.default || persona.avatar,
      personaColor: persona.color || '#6C63FF',
      viewport,
      device,
    });
  }

  // Start CDP screencast
  const stopScreencast = await startScreencast(page, sessionId.toString(), runId, io);

  const stepHistory = [];
  const visitedUrls = [];
  const pageAudits = [];
  const auditedUrls = new Set();

  let stepIndex = 0;
  let outcome = 'in_progress';
  let clickCount = 0;
  let rageClickCount = 0;
  let primaryCTAClicked = false;
  let detectedPrimaryCTAElement = null;
  const startTime = Date.now();
  let navStart = Date.now();

  const targetUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    let navSuccess = false;
    navStart = Date.now();

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      const currentUrl = page.url();
      if (!currentUrl.startsWith('chrome-error://')) {
        navSuccess = true;
      }
    } catch (navErr) {
      console.warn(`[agent] Navigation failed for ${targetUrl}:`, navErr.message);
    }

    if (!navSuccess || page.url().startsWith('chrome-error://')) {
      console.warn(`[agent] Site unreachable: ${targetUrl}`);
      outcome = 'failed';
      const duration = Math.round((Date.now() - startTime) / 1000);

      await Session.findByIdAndUpdate(sessionId, {
        outcome: 'failed',
        totalTime: duration,
        frustrationScore: 0,
        finalFeedback: 'Could not reach the site: connection refused or domain unreachable.',
      });

      if (io) {
        io.to(`run:${runId}`).emit('session:finished', {
          sessionId,
          personaName: persona.name,
          outcome: 'failed',
          frustrationScore: 0,
          finalFeedback: 'Could not reach the site.',
        });
      }

      await stopScreencast();
      await context.close().catch(() => {});
      return {
        sessionId,
        personaName: persona.name,
        outcome: 'failed',
        error: 'site unreachable',
        totalTime: duration,
        pageAudits: [],
      };
    }

    visitedUrls.push(page.url());

    let lastActionResult = 'Navigated to landing page.';
    let lastChosenElementIndex = null;
    let consecutiveUnchangedActions = 0;

    while (stepIndex < MAX_STEPS) {
      if (Date.now() - startTime > SESSION_TIMEOUT_MS) {
        console.warn(`[agent] Session ${sessionId} exceeded 120s timeout.`);
        outcome = 'gave_up';
        break;
      }

      // a. Extract page state & elements
      const pageState = await extractPageState(page);

      if (!detectedPrimaryCTAElement && pageState.elements.length > 0) {
        detectedPrimaryCTAElement = detectPrimaryCTA(pageState.elements);
      }

      if (!auditedUrls.has(pageState.url)) {
        auditedUrls.add(pageState.url);
        const audit = await runPageAudit(page, pageState.url, Date.now() - navStart);
        pageAudits.push(audit);
      }

      // Check for navigation backtracking loop
      const uLen = visitedUrls.length;
      if (uLen >= 6) {
        const u1 = visitedUrls[uLen - 1];
        const u2 = visitedUrls[uLen - 2];
        if (u1 !== u2 &&
            visitedUrls[uLen - 3] === u1 && visitedUrls[uLen - 4] === u2 &&
            visitedUrls[uLen - 5] === u1 && visitedUrls[uLen - 6] === u2) {
          console.warn(`[agent] Navigation loop detected for ${persona.name}. Forcing give_up.`);
          outcome = 'gave_up';
          break;
        }
      }

      // b. Build prompt + Call LLM
      const repeatWarning = consecutiveUnchangedActions >= 1
        ? `Your previous action on element #${lastChosenElementIndex} had NO effect. You MUST choose a different element or action.`
        : null;

      const userPrompt = buildPageStatePrompt(
        pageState,
        persona,
        goal,
        stepHistory.slice(-5),
        {
          lastActionResult,
          recentVisitedUrls: visitedUrls.slice(-4),
          repeatWarning,
        }
      );

      let rawLLMAction;
      try {
        rawLLMAction = await callLLM(persona.systemPrompt, userPrompt);
      } catch (err) {
        console.warn(`[agent] LLM call error step ${stepIndex}:`, err.message);
        rawLLMAction = {
          action: 'wait',
          thought: 'Waiting for the interface to respond.',
          emotion: 'neutral',
          frustration: 2,
        };
      }

      const decision = normalizeActionOutput(rawLLMAction, pageState.elements);

      if (decision.action === 'click' && decision.elementIndex != null && decision.elementIndex === lastChosenElementIndex && consecutiveUnchangedActions >= 1) {
        decision.action = 'scroll';
        decision.thought = 'Clicking that element had no effect. Scrolling to explore alternatives.';
      }

      if (detectedPrimaryCTAElement && decision.elementIndex === detectedPrimaryCTAElement.index) {
        primaryCTAClicked = true;
      }

      // Get target element bbox for planned event
      const targetElement = pageState.elements.find(e => e.index === decision.elementIndex);
      const targetLabel = targetElement ? `${targetElement.name || targetElement.tag} [${decision.elementIndex}]` : 'window';
      const targetBbox = targetElement?.bbox || null;
      const targetPoint = targetBbox ? {
        x: targetBbox.x + Math.round(targetBbox.w / 2),
        y: targetBbox.y + Math.round(targetBbox.h / 2),
      } : null;

      // c. Emit action:planned BEFORE executing
      if (io) {
        io.to(`run:${runId}`).emit('action:planned', {
          sessionId,
          type: decision.action,
          target: targetLabel,
          bbox: targetBbox,
          point: targetPoint,
          viewport,
          text: decision.text || null,
          thought: decision.thought,
          emotion: decision.emotion || 'neutral',
          frustration: Math.min(100, Math.max(0, (decision.frustration || 0) * 10)),
          stepIndex,
          personaName: persona.name,
          personaAvatar: persona.avatarSet?.default || persona.avatar,
          personaColor: persona.color || '#6C63FF',
          url: pageState.url,
        });
      }

      // d. Execute action
      const execResult = await executeAction(page, decision, pageState.elements, techSavviness);
      const screenshotUrl = await takeScreenshot(page, runId, stepIndex);

      if (execResult.domChanged || execResult.urlAfter !== pageState.url) {
        consecutiveUnchangedActions = 0;
        lastActionResult = execResult.urlAfter !== pageState.url
          ? `Navigated to ${execResult.urlAfter}`
          : 'DOM updated successfully.';
        if (!visitedUrls.includes(execResult.urlAfter)) {
          visitedUrls.push(execResult.urlAfter);
        }
      } else {
        consecutiveUnchangedActions++;
        lastActionResult = 'Nothing happened (no DOM or URL change).';
      }

      lastChosenElementIndex = decision.elementIndex;

      const isRealClick = execResult.actionExecuted === 'click' && execResult.x != null;
      if (isRealClick) clickCount++;

      const isRageClick = isRealClick && decision.frustration >= 7;
      if (isRageClick) rageClickCount++;

      const stepFrustration = Math.min(100, Math.max(0, decision.frustration * 10));

      // e. Emit action:result AFTER executing
      if (io) {
        io.to(`run:${runId}`).emit('action:result', {
          sessionId,
          urlChanged: execResult.urlAfter !== pageState.url,
          newUrl: execResult.urlAfter,
          domChanged: execResult.domChanged,
          dead: execResult.isDeadClick,
          isRageClick,
          stepIndex,
        });
      }

      // f. Save Step
      await Step.create({
        sessionId,
        runId,
        stepIndex,
        action: isRageClick ? 'rage_click' : execResult.actionExecuted,
        target: targetLabel,
        x: execResult.x,
        y: execResult.y,
        viewport,
        thought: decision.thought,
        emotion: decision.emotion,
        frustration: stepFrustration,
        screenshotUrl,
        isDeadClick: execResult.isDeadClick,
        domChanged: execResult.domChanged,
        url: pageState.url,
        pageTitle: pageState.title,
        personaName: persona.name,
        ts: new Date(),
      }).catch((e) => console.error('[agent] Step save error:', e.message));

      stepHistory.push({
        action: execResult.actionExecuted,
        elementIndex: decision.elementIndex,
        target: targetLabel,
        thought: decision.thought,
        emotion: decision.emotion,
        frustration: decision.frustration,
        url: pageState.url,
      });

      // g. Emit legacy step event (backwards compat)
      if (io) {
        io.to(`run:${runId}`).emit('step', {
          sessionId,
          personaName: persona.name,
          personaAvatar: persona.avatarSet?.default || persona.avatar,
          stepIndex,
          action: execResult.actionExecuted,
          x: execResult.x,
          y: execResult.y,
          thought: decision.thought,
          emotion: decision.emotion,
          frustration: stepFrustration,
          screenshotUrl,
          url: pageState.url,
        });
      }

      stepIndex++;

      if (decision.action === 'goal_complete') {
        outcome = 'completed';
        break;
      }
      if (decision.action === 'give_up') {
        outcome = 'gave_up';
        break;
      }
    }

    if (outcome === 'in_progress') {
      outcome = 'gave_up';
    }

    // Generate Persona Feedback Review
    let finalFeedback = '';
    try {
      const feedbackPrompt = `You are ${persona.name}. You just tested ${targetUrl} with the goal: "${goal}".
The outcome was: ${outcome}.
Steps taken:
${stepHistory.map((h, i) => `${i + 1}. [${h.action}] ${h.thought}`).join('\n')}

Write a concise 2-sentence first-person review of your experience. Cite specific issues encountered.`;
      finalFeedback = await callLLM(persona.systemPrompt, feedbackPrompt, { freeText: true });
    } catch {
      finalFeedback = outcome === 'completed'
        ? 'I completed the task successfully.'
        : 'I encountered difficulty navigating the interface and could not complete the goal.';
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const allSteps = await Step.find({ sessionId }).lean();

    const avgFrustration = allSteps.length
      ? Math.round(allSteps.reduce((s, st) => s + (st.frustration || 0), 0) / allSteps.length)
      : 0;

    const missedCTA = outcome !== 'completed' && !primaryCTAClicked;

    await Session.findByIdAndUpdate(sessionId, {
      outcome,
      totalTime,
      frustrationScore: avgFrustration,
      finalFeedback: finalFeedback.slice(0, 500),
      clickCount,
      rageClickCount,
      missedCTA,
    });

    if (io) {
      io.to(`run:${runId}`).emit('session:finished', {
        sessionId,
        personaName: persona.name,
        personaAvatar: persona.avatarSet?.default || persona.avatar,
        outcome,
        frustrationScore: avgFrustration,
        finalFeedback,
        screenshotUrl: await takeScreenshot(page, runId, stepIndex).catch(() => null),
      });
    }

    return {
      sessionId,
      personaName: persona.name,
      outcome,
      totalTime,
      avgFrustration,
      finalFeedback,
      pageAudits,
    };

  } finally {
    await stopScreencast();
    await context.close().catch(() => {});
  }
}

// ─── Run Orchestrator ─────────────────────────────────────────────────────────

export async function processAgentRun(runId, io) {
  const run = await Run.findById(runId);
  if (!run) throw new Error(`Run ${runId} not found`);

  await Run.findByIdAndUpdate(runId, { status: 'running', startedAt: new Date() });
  io?.to(`run:${runId}`).emit('run:started', { runId, personaCount: run.personaCount });

  const personas = await Persona.find().limit(run.personaCount).lean();
  if (!personas.length) throw new Error('No personas found. Run `npm run seed` first.');

  const CONCURRENCY = Math.max(1, Number(process.env.AGENT_CONCURRENCY) || 3);
  const sharedBrowser = await getSharedBrowser();
  const allPageAudits = [];

  try {
    for (let i = 0; i < personas.length; i += CONCURRENCY) {
      const batch = personas.slice(i, i + CONCURRENCY);

      const batchPromises = batch.map(async (persona) => {
        const session = await Session.create({
          runId,
          personaId: persona._id,
          personaSnapshot: {
            name: persona.name,
            age: persona.age,
            tag: persona.traits?.ageGroup || persona.tag || 'general',
            traits: persona.traits,
            avatar: persona.avatarSet?.default || persona.avatar,
            avatarSet: persona.avatarSet,
          },
          outcome: 'in_progress',
        });

        // session:started is now emitted inside runPersonaSession with viewport info

        const sessionJobData = {
          runId,
          sessionId: session._id.toString(),
          personaId: persona._id.toString(),
          goal: run.goal,
          url: run.url,
          device: run.device || 'desktop',
        };

        try {
          const res = await runPersonaSession(sessionJobData, io, sharedBrowser);
          if (res?.pageAudits) allPageAudits.push(...res.pageAudits);
          return res;
        } catch (err) {
          console.error(`[agent] Session failed for ${persona.name}:`, err.message);
          await Session.findByIdAndUpdate(session._id, {
            outcome: 'failed',
            finalFeedback: 'Session encountered an error: ' + err.message,
          });
          return { sessionId: session._id, personaName: persona.name, outcome: 'failed', error: err.message };
        }
      });

      await Promise.all(batchPromises);
    }

    const sessions = await Session.find({ runId }).lean();
    const allSteps = await Step.find({ runId }).lean();
    const sessionsWithSteps = sessions.map((s) => ({
      ...s,
      steps: allSteps.filter((st) => st.sessionId?.toString() === s._id?.toString()),
    }));

    const allFailedSite = sessions.length > 0 && sessions.every((s) => s.outcome === 'failed');

    if (allFailedSite) {
      console.warn(`[agent] All sessions failed due to site unreachable: ${run.url}`);
      const failedSummary = {
        schemaVersion: 2,
        totalSessions: sessions.length,
        completedCount: 0,
        gaveUpCount: 0,
        taskSuccessRate: 0,
        avgFrustration: 0,
        avgSessionTime: 0,
        ctaMissRate: 0,
        frictionScore: 0,
        errorMessage: 'Could not reach the site: connection refused or invalid URL.',
        topIssues: [{
          title: 'Site Unreachable',
          severity: 'critical',
          affectedCount: sessions.length,
          description: `Could not reach ${run.url}. The server is offline or unreachable.`,
          suggestedFix: 'Ensure the target website server is running and accessible.',
        }],
        personaTypeScores: [],
        funnel: [],
        heatmapPoints: [],
        pageAudits: [],
      };

      await Run.findByIdAndUpdate(runId, {
        status: 'failed',
        summary: failedSummary,
        scores: { taskSuccessRate: 0, avgFrustration: 0, ctaMissRate: 0, avgSessionTime: 0 },
        completedAt: new Date(),
      });

      io?.to(`run:${runId}`).emit('run:failed', { runId, error: 'Could not reach the site' });
      return failedSummary;
    }

    let topIssues = [];
    const validFeedbacks = sessions
      .filter((s) => s.outcome !== 'failed' && s.finalFeedback)
      .map((s) => ({
        personaName: s.personaSnapshot?.name || 'Tester',
        outcome: s.outcome,
        feedback: s.finalFeedback,
      }));

    if (validFeedbacks.length > 0) {
      try {
        const summarySystemPrompt = 'You are a senior UX researcher analyzing real usability tests. You MUST ground every finding in the provided data.';
        const summaryUserPrompt = buildSummaryPrompt(validFeedbacks, run.goal, run.url, allPageAudits);
        const rawIssues = await callLLM(summarySystemPrompt, summaryUserPrompt, { schema: SUMMARY_SCHEMA });

        const visitedCorpus = [
          run.url,
          ...allPageAudits.map((a) => `${a.pathname} ${(a.findings || []).map(f => f.detail + ' ' + f.text).join(' ')}`),
          ...validFeedbacks.map((f) => f.feedback),
        ].join(' ');

        topIssues = filterAndGroundedIssues(rawIssues, validFeedbacks, allPageAudits, sessions.length, visitedCorpus);
      } catch (err) {
        console.warn('[agent] Summary LLM call failed:', err.message);
        topIssues = filterAndGroundedIssues([], validFeedbacks, allPageAudits, sessions.length, run.url);
      }
    }

    const metrics = buildRunMetrics(sessionsWithSteps);
    const personaTypeScores = buildPerPersonaTypeScores(sessions);
    const funnel = buildDropOffFunnel(sessionsWithSteps);

    const summary = {
      ...metrics,
      topIssues,
      personaTypeScores,
      funnel,
      pageAudits: allPageAudits.slice(0, 10),
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

    if (run.userId) {
      try {
        const { default: Notification } = await import('../models/Notification.js');
        await Notification.create({
          userId: run.userId,
          title: 'Run Completed',
          message: `Usability test for ${run.url} finished with ${metrics.taskSuccessRate}% success rate.`,
          type: 'run_completed',
          link: `/app/dashboard?runId=${runId}`,
        });
      } catch (nErr) {
        console.warn('[agent] Failed to create notification:', nErr.message);
      }
    }

    io?.to(`run:${runId}`).emit('run:finished', { runId, summary });

    console.log(`[agent] ✅ Run ${runId} completed. Success: ${metrics.taskSuccessRate}% | Issues: ${topIssues.length}`);
    return summary;

  } catch (err) {
    console.error(`[agent] Fatal error in processAgentRun ${runId}:`, err);
    await Run.findByIdAndUpdate(runId, {
      status: 'failed',
      'summary.errorMessage': err.message,
      completedAt: new Date(),
    });

    if (run?.userId) {
      try {
        const { default: Notification } = await import('../models/Notification.js');
        await Notification.create({
          userId: run.userId,
          title: 'Run Failed',
          message: `Usability test for ${run?.url || 'site'} failed: ${err.message}`,
          type: 'run_failed',
          link: `/app/dashboard?runId=${runId}`,
        });
      } catch (nErr) {}
    }

    io?.to(`run:${runId}`).emit('run:failed', { runId, error: err.message });
    throw err;
  }
}

export default {
  runPersonaSession,
  processAgentRun,
};
