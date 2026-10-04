/**
 * server/src/services/fixEmulator.js
 *
 * Fix Emulator Service — for each affected page:
 *   1. Open the ORIGINAL page in Playwright (same viewport as the run)
 *   2. Screenshot "before" (full page)
 *   3. Apply the enabled validated patch ops to the DOM
 *   4. Wait for stability
 *   5. Screenshot "after" (full page)
 *   6. Produce an element-diff list (bbox of every changed element with fix id)
 *
 * Safety:
 *   - Only for sites whose ownershipVerified = true OR localhost in dev
 *   - All patch ops come pre-validated through fixPatcher.js whitelist
 *   - Timeouts enforced
 *   - No persistence of patched pages beyond screenshots
 *   - Pages that cannot be patched reliably → previewAvailable = false
 *
 * Caching: results are stored in FixCache (see models/FixCache.js)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { chromium } from 'playwright';
import { applyPatchOpsToPage } from './fixPatcher.js';

const SCREENSHOTS_DIR = path.resolve('screenshots');
const PREVIEW_DIR = path.join(SCREENSHOTS_DIR, 'fix-previews');

// Ensure directories exist
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile:  { width: 390, height: 844 },
  slow:    { width: 390, height: 844 },
};

const PAGE_TIMEOUT = 30_000; // 30s per page
const STABILITY_WAIT = 800;  // ms after patches applied

// Shared browser for fix emulator (separate from agent)
let _emulatorBrowser = null;

async function getEmulatorBrowser() {
  if (!_emulatorBrowser || !_emulatorBrowser.isConnected()) {
    _emulatorBrowser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security', // allow same-origin DOM manipulation in tests
      ],
    });
  }
  return _emulatorBrowser;
}

/**
 * Build a stable cache key for a given (runId, pagePath, enabledFixIds[]) combination.
 */
export function buildCacheKey(runId, pagePath, enabledFixIds) {
  const sorted = [...enabledFixIds].sort().join(',');
  return crypto
    .createHash('md5')
    .update(`${runId}|${pagePath}|${sorted}`)
    .digest('hex');
}

/**
 * Check if preview is feasible for this URL.
 * Heavy canvas apps, cross-origin iframes, and fully closed shadow DOMs
 * cannot be patched reliably.
 */
async function checkPreviewFeasibility(page) {
  return page.evaluate(() => {
    // Check for heavy canvas usage (game engines, maps)
    const canvases = document.querySelectorAll('canvas');
    const hasHeavyCanvas = [...canvases].some(c => {
      const rect = c.getBoundingClientRect();
      return rect.width > 600 && rect.height > 400;
    });
    if (hasHeavyCanvas) return { feasible: false, reason: 'Heavy canvas detected (game/map engine)' };

    // Check for cross-origin iframes
    const iframes = document.querySelectorAll('iframe');
    if (iframes.length > 2) return { feasible: false, reason: 'Multiple cross-origin iframes detected' };

    return { feasible: true };
  }).catch(() => ({ feasible: true }));
}

/**
 * Collect bounding boxes of all elements that match given selectors.
 * Used to produce "pin" positions for changed elements in the UI.
 */
async function collectElementBboxes(page, fixes) {
  const bboxes = [];

  for (const fix of fixes) {
    for (const op of (fix.patchOps || [])) {
      try {
        const result = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          const scrollY = window.scrollY || document.documentElement.scrollTop;
          const scrollX = window.scrollX || document.documentElement.scrollLeft;
          return {
            x: Math.round(rect.left + scrollX),
            y: Math.round(rect.top + scrollY),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }, op.selector);

        if (result) {
          bboxes.push({
            fixId: fix.id,
            fixTitle: fix.title,
            selector: op.selector,
            bbox: result,
          });
          break; // one bbox per fix is enough
        }
      } catch {
        // Element not found in DOM — skip
      }
    }
  }

  return bboxes;
}

/**
 * Generate before/after screenshots for a single page with given fixes applied.
 *
 * @param {object} params
 * @param {string} params.runId
 * @param {string} params.pageUrl - full URL to visit
 * @param {string} params.pagePath - pathname for labeling
 * @param {object[]} params.fixes - fixes to apply (pre-validated)
 * @param {string[]} params.enabledFixIds - which fix ids to apply
 * @param {string} params.device - 'desktop' | 'mobile' | 'slow'
 * @param {string} params.cacheKey
 * @returns {Promise<object>} - { beforeUrl, afterUrl, bboxes, feasible, reason, patchResults }
 */
export async function generatePreviewScreenshots({
  runId,
  pageUrl,
  pagePath,
  fixes,
  enabledFixIds,
  device = 'desktop',
  cacheKey,
}) {
  const viewport = VIEWPORTS[device] || VIEWPORTS.desktop;
  const browser = await getEmulatorBrowser();

  const context = await browser.newContext({
    viewport,
    userAgent: 'Mozilla/5.0 (compatible; PersonifyFixEmulator/1.0)',
    javaScriptEnabled: true,
  });

  const page = await context.newPage();
  let beforeUrl = null;
  let afterUrl = null;
  let bboxes = [];
  let feasible = true;
  let reason = null;
  let patchResults = [];

  try {
    page.setDefaultTimeout(PAGE_TIMEOUT);

    // Navigate to page
    await page.goto(pageUrl, {
      waitUntil: 'networkidle',
      timeout: PAGE_TIMEOUT,
    }).catch(() => page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT }));

    // Wait for basic content
    await page.waitForTimeout(500);

    // Check feasibility
    const feasibility = await checkPreviewFeasibility(page);
    if (!feasibility.feasible) {
      feasible = false;
      reason = feasibility.reason;
      return { beforeUrl: null, afterUrl: null, bboxes: [], feasible: false, reason, patchResults: [] };
    }

    // BEFORE screenshot (full page)
    const beforeFilename = `${cacheKey}_before.png`;
    const beforePath = path.join(PREVIEW_DIR, beforeFilename);

    if (!fs.existsSync(beforePath)) {
      await page.screenshot({
        path: beforePath,
        fullPage: true,
        type: 'png',
      });
    }
    beforeUrl = `/screenshots/fix-previews/${beforeFilename}`;

    // Collect element positions BEFORE patching (for pin placement)
    const activeFixes = fixes.filter(f => enabledFixIds.includes(f.id));
    bboxes = await collectElementBboxes(page, activeFixes);

    // Apply enabled patches
    for (const fix of activeFixes) {
      const ops = fix.patchOps || [];
      const results = await applyPatchOpsToPage(page, ops);
      patchResults.push({ fixId: fix.id, results });
    }

    // Wait for DOM to stabilize
    await page.waitForTimeout(STABILITY_WAIT);
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

    // AFTER screenshot (full page)
    const afterFilename = `${cacheKey}_after.png`;
    const afterPath = path.join(PREVIEW_DIR, afterFilename);
    await page.screenshot({
      path: afterPath,
      fullPage: true,
      type: 'png',
    });
    afterUrl = `/screenshots/fix-previews/${afterFilename}`;

  } catch (err) {
    console.error(`[fixEmulator] Screenshot error for ${pageUrl}:`, err.message);
    feasible = false;
    reason = `Preview generation failed: ${err.message}`;
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }

  return { beforeUrl, afterUrl, bboxes, feasible, reason, patchResults };
}

/**
 * Build a Playwright initScript that injects the enabled patch ops.
 * Used by the re-test (patched child run) to apply fixes on every page load.
 *
 * @param {object[]} fixes - validated fix objects
 * @param {string[]} enabledFixIds
 * @returns {string} - JS code to pass to context.addInitScript()
 */
export function buildInitScript(fixes, enabledFixIds) {
  const activeFixes = fixes.filter(f => enabledFixIds.includes(f.id));
  const scripts = [];

  for (const fix of activeFixes) {
    for (const op of (fix.patchOps || [])) {
      const { buildOpScript } = require('./fixPatcher.js');
      scripts.push(buildOpScript(op));
    }
  }

  return `
(function() {
  function applyFixes() {
    ${scripts.map((s, i) => `
    try { ${s}; } catch(e) { /* fix ${i} failed: */ }
    `).join('\n')}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFixes);
  } else {
    applyFixes();
  }

  // Re-apply after any SPA navigation
  var _pushState = history.pushState.bind(history);
  history.pushState = function() { _pushState.apply(history, arguments); setTimeout(applyFixes, 200); };
  window.addEventListener('popstate', function() { setTimeout(applyFixes, 200); });
})();
`.trim();
}

/**
 * Build an initScript using dynamic imports (ES module compatible version).
 */
export async function buildInitScriptAsync(fixes, enabledFixIds) {
  const { buildOpScript } = await import('./fixPatcher.js');
  const activeFixes = fixes.filter(f => enabledFixIds.includes(f.id));
  const scripts = [];

  for (const fix of activeFixes) {
    for (const op of (fix.patchOps || [])) {
      try {
        scripts.push(buildOpScript(op));
      } catch (e) {
        console.warn(`[fixEmulator] Could not build op script for fix ${fix.id}:`, e.message);
      }
    }
  }

  return `
(function() {
  function applyFixes() {
    ${scripts.map((s, i) => `
    try { (function(){ ${s} })(); } catch(e) { console.warn('[PersonifyFix ${i}]', e); }
    `).join('\n')}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFixes);
  } else {
    applyFixes();
  }

  var _pushState = history.pushState.bind(history);
  history.pushState = function() { _pushState.apply(history, arguments); setTimeout(applyFixes, 200); };
  window.addEventListener('popstate', function() { setTimeout(applyFixes, 200); });
})();
`.trim();
}

export default {
  generatePreviewScreenshots,
  buildCacheKey,
  buildInitScript,
  buildInitScriptAsync,
};
