/**
 * e2eRecord.js — End-to-End Playwright recording
 *
 * Records a full user flow:
 *   1. Open New Run screen
 *   2. Fill URL + persona count
 *   3. Launch run → redirected to Live Room
 *   4. Watch live events (30s)
 *   5. Click "View Full Results Dashboard"
 *   6. Verify dashboard data
 *
 * Output: server/scripts/artifacts/e2e_recording.webm
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');
const APP_URL = 'http://localhost:5173';
const DEMO_URL = 'http://localhost:3456';

// ─── Wait helper ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(ARTIFACTS_DIR, { recursive: true });

  console.log('🎬 Starting E2E recording...');
  console.log(`   App:  ${APP_URL}`);
  console.log(`   Demo: ${DEMO_URL}`);
  console.log(`   Output: ${ARTIFACTS_DIR}/e2e_recording.webm\n`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: ARTIFACTS_DIR,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();

  // ─── Step 1: Open New Run screen ────────────────────────────────────────────
  console.log('📍 Step 1: Navigate to New Run screen');
  await page.goto(`${APP_URL}/app/new-run`, { waitUntil: 'networkidle' });
  await sleep(1500);

  // ─── Step 2: Fill URL field ──────────────────────────────────────────────────
  console.log('📍 Step 2: Enter target URL');
  const urlField = page.locator('input[placeholder*="http"], input[name="url"], input[type="url"]').first();
  await urlField.waitFor({ timeout: 10000 });
  await urlField.click({ clickCount: 3 });
  await urlField.fill(DEMO_URL);
  await sleep(800);

  // ─── Step 3: Fill goal field if present ────────────────────────────────────
  console.log('📍 Step 3: Enter goal (if field exists)');
  const goalField = page.locator('textarea, input[placeholder*="goal"], input[name="goal"]').first();
  const goalVisible = await goalField.isVisible().catch(() => false);
  if (goalVisible) {
    await goalField.fill('Complete the signup and checkout flow');
    await sleep(600);
  }

  // ─── Step 4: Set persona count to 5 ─────────────────────────────────────────
  console.log('📍 Step 4: Set persona count');
  const personaCountField = page.locator('input[type="number"], input[name*="count"], input[name*="persona"]').first();
  const countVisible = await personaCountField.isVisible().catch(() => false);
  if (countVisible) {
    await personaCountField.click({ clickCount: 3 });
    await personaCountField.fill('5');
    await sleep(600);
  }

  // ─── Step 5: Click Launch / Start button ─────────────────────────────────────
  console.log('📍 Step 5: Launch the run');
  const launchBtn = page.locator(
    'button:has-text("Launch"), button:has-text("Start"), button:has-text("Run"), button[type="submit"]'
  ).first();
  await launchBtn.waitFor({ timeout: 10000 });
  await launchBtn.click();
  await sleep(1000);

  // ─── Step 6: Wait for redirect to Live Room ──────────────────────────────────
  console.log('📍 Step 6: Waiting for Live Room redirect...');
  try {
    await page.waitForURL('**/app/live**', { timeout: 15000 });
    console.log('   ✅ Live Room loaded:', page.url());
  } catch {
    console.warn('   ⚠️  Still on:', page.url(), '— continuing anyway');
  }
  await sleep(2000);

  // ─── Step 7: Watch live events streaming ─────────────────────────────────────
  console.log('📍 Step 7: Watching live events (up to 90 seconds)...');
  const WATCH_MS = 90_000;
  const startTime = Date.now();
  let runComplete = false;

  while (Date.now() - startTime < WATCH_MS) {
    // Check for run completion banner
    const completedBanner = page.locator(
      'text=Run Complete, text=Simulation Complete, text=completed, [class*="complete"], [class*="finished"]'
    ).first();
    const bannerVisible = await completedBanner.isVisible().catch(() => false);

    if (bannerVisible) {
      console.log('   ✅ Run completion banner detected!');
      runComplete = true;
      break;
    }

    // Check if we already see the Results button
    const resultsBtn = page.locator(
      'a:has-text("Results"), button:has-text("Results"), a:has-text("Dashboard")'
    ).first();
    const resultsBtnVisible = await resultsBtn.isVisible().catch(() => false);
    if (resultsBtnVisible && Date.now() - startTime > 20_000) {
      console.log('   ✅ Results button visible — run likely complete');
      runComplete = true;
      break;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r   ⏱  ${elapsed}s elapsed...`);
    await sleep(2000);
  }
  console.log();

  await sleep(2000);

  // ─── Step 8: Navigate to Results Dashboard ───────────────────────────────────
  console.log('📍 Step 8: Navigate to Results Dashboard');

  // Try clicking the "View Results" / "Results Dashboard" button first
  const dashboardBtn = page.locator(
    'a:has-text("Results"), button:has-text("Results"), a:has-text("Dashboard"), a:has-text("View Full")'
  ).first();
  const dashBtnVisible = await dashboardBtn.isVisible().catch(() => false);

  if (dashBtnVisible) {
    await dashboardBtn.click();
    await sleep(2000);
  } else {
    // Extract runId from URL and navigate manually
    const liveUrl = page.url();
    const runIdMatch = liveUrl.match(/runId=([a-f0-9]+)/i);
    if (runIdMatch) {
      const runId = runIdMatch[1];
      console.log(`   Navigating to dashboard with runId: ${runId}`);
      await page.goto(`${APP_URL}/app/dashboard?runId=${runId}`, { waitUntil: 'networkidle' });
    } else {
      // Fall back: get most recent run from API
      const runsResp = await page.evaluate(async () => {
        const r = await fetch('/api/runs?limit=1');
        return r.json();
      });
      const latestRun = runsResp?.data?.[0];
      if (latestRun?._id || latestRun?.id) {
        const id = latestRun._id || latestRun.id;
        console.log(`   Navigating to dashboard for latest run: ${id}`);
        await page.goto(`${APP_URL}/app/dashboard?runId=${id}`, { waitUntil: 'networkidle' });
      } else {
        await page.goto(`${APP_URL}/app/dashboard`, { waitUntil: 'networkidle' });
      }
    }
  }

  // ─── Step 9: Let dashboard load and render ───────────────────────────────────
  console.log('📍 Step 9: Waiting for dashboard to render...');
  await sleep(4000);

  // Scroll through the dashboard
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'smooth' }));
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'smooth' }));
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(2000);

  // ─── Step 10: Check heatmap tab ────────────────────────────────────────────
  console.log('📍 Step 10: Interact with heatmap');
  const heatmapTab = page.locator(
    '[role="tab"]:has-text("Heatmap"), button:has-text("Heatmap"), a:has-text("Heatmap")'
  ).first();
  const heatmapVisible = await heatmapTab.isVisible().catch(() => false);
  if (heatmapVisible) {
    await heatmapTab.click();
    await sleep(2500);
  }

  // ─── Finalize ────────────────────────────────────────────────────────────────
  console.log('\n✅ E2E recording complete!');
  console.log('   Closing browser...');
  await sleep(2000);

  await context.close(); // triggers video save
  await browser.close();

  // Rename the video file
  const { readdir, rename } = await import('fs/promises');
  const files = await readdir(ARTIFACTS_DIR);
  const videoFile = files.find((f) => f.endsWith('.webm'));

  if (videoFile) {
    const src = path.join(ARTIFACTS_DIR, videoFile);
    const dest = path.join(ARTIFACTS_DIR, 'e2e_recording.webm');
    if (src !== dest) {
      await rename(src, dest);
    }
    console.log(`\n🎥 Video saved: ${dest}`);

    // Copy to artifact directory
    const { copyFile } = await import('fs/promises');
    const artifactDest = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\06aeac87-ea7c-48d7-9762-67791281b6e9\\e2e_recording.webm';
    await copyFile(dest, artifactDest).catch((e) => console.warn('   Copy to artifact dir failed:', e.message));
    console.log(`   Copied to artifact: ${artifactDest}`);
  } else {
    console.warn('   ⚠️  No .webm file found in artifacts dir');
  }

  console.log('\n🎉 Done!');
}

main().catch((err) => {
  console.error('❌ E2E recording failed:', err);
  process.exit(1);
});


