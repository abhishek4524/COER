/**
 * server/src/services/aggregator.js
 *
 * Rule-based friction detection + metrics aggregation.
 *
 * Exported functions:
 *   detectFriction(steps)        → { rageClicks, deadClicks, loops, deadEnds }
 *   buildHeatmapPoints(steps)    → HeatmapPoint[]
 *   buildRunMetrics(sessions)    → RunMetrics
 *   buildPerPersonaTypeScores(sessions, personas) → Record<tag, score>
 *   buildDropOffFunnel(sessions) → FunnelStep[]
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const RAGE_CLICK_RADIUS_PX = 40;
const RAGE_CLICK_WINDOW_MS = 2000;
const RAGE_CLICK_MIN_COUNT = 3;

const DEAD_CLICK_TOLERANCE_MS = 1500; // wait this long for DOM change
const LOOP_SAME_STATE_COUNT = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Identify rage-click clusters: 3+ clicks within 40px within 2s.
 * Returns an array of cluster objects.
 */
export function detectRageClicks(steps) {
  const clicks = steps.filter((s) => s.action === 'click' && s.x != null);
  const clusters = [];
  const used = new Set();

  for (let i = 0; i < clicks.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < clicks.length; j++) {
      if (used.has(j)) continue;
      const withinRadius = dist(clicks[i], clicks[j]) <= RAGE_CLICK_RADIUS_PX;
      const withinTime =
        Math.abs(new Date(clicks[j].ts) - new Date(clicks[i].ts)) <= RAGE_CLICK_WINDOW_MS;
      if (withinRadius && withinTime) group.push(j);
    }
    if (group.length >= RAGE_CLICK_MIN_COUNT) {
      group.forEach((idx) => used.add(idx));
      clusters.push({
        x: Math.round(clicks[group[0]].x),
        y: Math.round(clicks[group[0]].y),
        count: group.length,
        personaName: clicks[group[0]].personaName,
        ts: clicks[group[0]].ts,
      });
    }
  }
  return clusters;
}

/**
 * Identify dead clicks: clicks after which URL and page title didn't change
 * within the next step.
 */
export function detectDeadClicks(steps) {
  const deadClicks = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const step = steps[i];
    const next = steps[i + 1];
    if (step.action !== 'click') continue;
    const urlSame = step.url === next.url;
    const titleSame = step.pageTitle === next.pageTitle;
    if (urlSame && titleSame && !next.domChanged) {
      deadClicks.push({
        x: step.x,
        y: step.y,
        target: step.target,
        personaName: step.personaName,
        ts: step.ts,
      });
    }
  }
  return deadClicks;
}

/**
 * Identify navigation loops: same URL visited 3+ times in a row.
 */
export function detectLoops(steps) {
  const loops = [];
  let streak = 1;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].url === steps[i - 1].url) {
      streak++;
      if (streak === LOOP_SAME_STATE_COUNT) {
        loops.push({ url: steps[i].url, count: streak, stepIndex: i });
      }
    } else {
      streak = 1;
    }
  }
  return loops;
}

/**
 * Identify dead ends: steps where the persona expressed give_up.
 */
export function detectDeadEnds(steps) {
  return steps
    .filter((s) => s.action === 'give_up')
    .map((s) => ({ url: s.url, target: s.target, thought: s.thought, ts: s.ts }));
}

/**
 * Run all friction detections and return a combined report.
 */
export function detectFriction(steps) {
  return {
    rageClicks: detectRageClicks(steps),
    deadClicks: detectDeadClicks(steps),
    loops: detectLoops(steps),
    deadEnds: detectDeadEnds(steps),
    frictionScore: computeFrictionScore(steps),
  };
}

/**
 * Composite friction score 0-100.
 */
function computeFrictionScore(steps) {
  if (!steps.length) return 0;
  const avgFrustration = steps.reduce((s, step) => s + (step.frustration || 0), 0) / steps.length;
  // frustration is 0-10 in LLM output; scale to 0-100
  return Math.min(100, Math.round(avgFrustration * 10));
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

/**
 * Convert steps into heatmap data points.
 */
export function buildHeatmapPoints(steps) {
  return steps
    .filter((s) => s.x != null && s.y != null)
    .map((s) => ({
      x: s.x,
      y: s.y,
      type: s.action === 'rage_click' ? 'rage'
        : s.isDeadClick ? 'dead'
        : s.action === 'scroll' ? 'scroll'
        : 'click',
      intensity: 1,
      personaName: s.personaName,
      emotion: s.emotion,
      frustration: s.frustration,
      ts: s.ts,
    }));
}

// ─── Run-level Metrics ────────────────────────────────────────────────────────

/**
 * Aggregate metrics across all sessions of a run.
 * @param {Array} sessions  Array of session docs with `.steps` populated
 */
export function buildRunMetrics(sessions) {
  if (!sessions.length) return defaultMetrics();

  const completed = sessions.filter((s) => s.outcome === 'completed');
  const gaveUp = sessions.filter((s) => s.outcome === 'gave_up');

  const taskSuccessRate = Math.round((completed.length / sessions.length) * 100);

  const allSteps = sessions.flatMap((s) => s.steps || []);
  const avgFrustration = allSteps.length
    ? Math.round(allSteps.reduce((acc, s) => acc + (s.frustration || 0), 0) / allSteps.length * 10)
    : 0;

  const totalTimes = sessions
    .filter((s) => s.totalTime > 0)
    .map((s) => s.totalTime);
  const avgSessionTime = totalTimes.length
    ? Math.round(totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length)
    : 0;

  const ctaMissRate = allSteps.length
    ? Math.round((allSteps.filter((s) => s.action === 'dead_click' || s.isDeadClick).length / allSteps.length) * 100)
    : 0;

  // Drop-off step = most common last step index among give_up sessions
  const dropOffCounts = {};
  gaveUp.forEach((sess) => {
    const lastStep = (sess.steps || []).length;
    dropOffCounts[lastStep] = (dropOffCounts[lastStep] || 0) + 1;
  });
  const dropOffStep = Object.entries(dropOffCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const heatmapPoints = buildHeatmapPoints(allSteps);
  const frictionReport = detectFriction(allSteps);

  return {
    taskSuccessRate,
    avgFrustration,
    avgSessionTime,
    ctaMissRate,
    completedCount: completed.length,
    gaveUpCount: gaveUp.length,
    totalSessions: sessions.length,
    dropOffStep: dropOffStep ? Number(dropOffStep) : null,
    heatmapPoints,
    frictionReport,
  };
}

function defaultMetrics() {
  return {
    taskSuccessRate: 0,
    avgFrustration: 0,
    avgSessionTime: 0,
    ctaMissRate: 0,
    completedCount: 0,
    gaveUpCount: 0,
    totalSessions: 0,
    dropOffStep: null,
    heatmapPoints: [],
    frictionReport: { rageClicks: [], deadClicks: [], loops: [], deadEnds: [], frictionScore: 0 },
  };
}

// ─── Per-persona-type Scores ──────────────────────────────────────────────────

/**
 * Group sessions by persona tag and compute success rate + avg frustration per group.
 * @param {Array} sessions  Sessions with `.personaSnapshot.tag`
 */
export function buildPerPersonaTypeScores(sessions) {
  const byTag = {};

  for (const sess of sessions) {
    const tag = sess.personaSnapshot?.tag || 'Unknown';
    if (!byTag[tag]) byTag[tag] = { completed: 0, total: 0, frustrationSum: 0 };
    byTag[tag].total++;
    if (sess.outcome === 'completed') byTag[tag].completed++;
    byTag[tag].frustrationSum += sess.frustrationScore || 0;
  }

  return Object.entries(byTag).map(([tag, data]) => ({
    tag,
    successRate: Math.round((data.completed / data.total) * 100),
    avgFrustration: Math.round(data.frustrationSum / data.total),
    sessionCount: data.total,
  }));
}

// ─── Drop-off Funnel ──────────────────────────────────────────────────────────

/**
 * Build a funnel showing how many personas reached each step.
 * @param {Array} sessions  Sessions with `.steps` populated
 */
export function buildDropOffFunnel(sessions) {
  if (!sessions.length) return [];

  // Find the max step count across all sessions
  const maxSteps = Math.max(...sessions.map((s) => (s.steps || []).length));

  const funnel = [];
  for (let i = 0; i <= maxSteps; i++) {
    const reached = sessions.filter((s) => (s.steps || []).length > i).length;
    funnel.push({
      step: i,
      label: `Step ${i + 1}`,
      count: reached,
      pct: Math.round((reached / sessions.length) * 100),
    });
  }
  return funnel;
}
