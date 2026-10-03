/**
 * server/src/services/aggregator.js
 *
 * Metrics aggregation and rule-based friction detection:
 * - Real click and rage click detection
 * - Dead click detection
 * - Navigation loop detection (same page repetition + 3-way backtrack cycle)
 * - Deterministic friction score (0-100)
 * - Frustration normalized to 0-100 everywhere
 * - Primary CTA detection and ctaMissRate calculation
 * - Drop-off funnel based on distinct page paths visited
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const RAGE_CLICK_RADIUS_PX = 40;
const RAGE_CLICK_WINDOW_MS = 2000;
const RAGE_CLICK_MIN_COUNT = 3;

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Identify rage-click clusters: 3+ clicks within 40px within 2s.
 */
export function detectRageClicks(steps) {
  const clicks = steps.filter((s) => s.action === 'click' && s.x != null && s.y != null);
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
 * Identify dead clicks: real clicks where neither URL nor DOM changed.
 */
export function detectDeadClicks(steps) {
  return steps
    .filter((s) => (s.action === 'click' || s.action === 'rage_click') && s.x != null && s.isDeadClick)
    .map((s) => ({
      x: s.x,
      y: s.y,
      target: s.target,
      personaName: s.personaName,
      ts: s.ts,
    }));
}

/**
 * Identify navigation loops:
 * 1) 3 consecutive steps on the same URL with no state change
 * 2) Backtracking: alternating between two pages 3 times (A -> B -> A -> B -> A -> B)
 */
export function detectLoops(steps) {
  const loops = [];
  if (!steps || steps.length < 3) return loops;

  // 1) 3 consecutive steps on same URL
  let streak = 1;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].url && steps[i].url === steps[i - 1].url && !steps[i].domChanged) {
      streak++;
      if (streak === 3) {
        loops.push({
          type: 'stagnation',
          url: steps[i].url,
          count: streak,
          stepIndex: i,
        });
      }
    } else {
      streak = 1;
    }
  }

  // 2) Backtrack pattern (A -> B -> A -> B -> A -> B)
  const urls = steps.map((s) => s.url).filter(Boolean);
  for (let i = 0; i <= urls.length - 6; i++) {
    const a = urls[i];
    const b = urls[i + 1];
    if (a && b && a !== b) {
      if (
        urls[i + 2] === a &&
        urls[i + 3] === b &&
        urls[i + 4] === a &&
        urls[i + 5] === b
      ) {
        loops.push({
          type: 'backtrack',
          urls: [a, b],
          count: 3,
          stepIndex: i + 5,
        });
        i += 5; // skip detected loop
      }
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
 * Deterministic Composite Friction Score (0-100)
 * Computed in code from rage clicks, dead clicks, loops, failed actions, and abandonment rate.
 */
export function computeFrictionScore({ rageClicks = [], deadClicks = [], loops = [], failedActions = [], totalSessions = 1, gaveUpCount = 0 }) {
  if (totalSessions <= 0) return 0;

  const ragePoints = (rageClicks.length || 0) * 15;
  const deadPoints = (deadClicks.length || 0) * 8;
  const loopPoints = (loops.length || 0) * 20;
  const failedActionPoints = (failedActions.length || 0) * 12;

  const actionFriction = (ragePoints + deadPoints + loopPoints + failedActionPoints) / Math.max(1, totalSessions);
  const abandonmentRate = gaveUpCount / Math.max(1, totalSessions);
  const abandonmentFriction = abandonmentRate * 45;

  const composite = Math.round(actionFriction + abandonmentFriction);
  return Math.min(100, Math.max(0, composite));
}

/**
 * Run all friction detections on steps.
 */
export function detectFriction(steps = [], totalSessions = 1, gaveUpCount = 0) {
  const rageClicks = detectRageClicks(steps);
  const deadClicks = detectDeadClicks(steps);
  const loops = detectLoops(steps);
  const deadEnds = detectDeadEnds(steps);
  const failedActions = steps.filter((s) => s.action === 'failed_action');

  const frictionScore = computeFrictionScore({
    rageClicks,
    deadClicks,
    loops,
    failedActions,
    totalSessions,
    gaveUpCount,
  });

  return {
    rageClicks,
    deadClicks,
    loops,
    deadEnds,
    failedActions,
    frictionScore,
  };
}

/**
 * Convert steps into heatmap data points.
 * NEVER includes (640, 360) viewport center fallbacks.
 */
export function buildHeatmapPoints(steps) {
  return steps
    .filter((s) => s.x != null && s.y != null && (s.action === 'click' || s.action === 'rage_click'))
    .map((s) => ({
      x: s.x,
      y: s.y,
      type: s.action === 'rage_click' ? 'rage' : s.isDeadClick ? 'dead' : 'click',
      intensity: s.frustration > 60 ? 2 : 1,
      personaName: s.personaName,
      emotion: s.emotion,
      frustration: s.frustration,
      url: s.url,
      ts: s.ts,
    }));
}

/**
 * Primary CTA Detection:
 * On landing view, scans interactive elements to identify the primary Call-To-Action.
 * Criteria:
 * 1. Buttons or links with high-intent keywords ('buy', 'order', 'checkout', 'sign up', 'register', 'start', 'contact', 'create account')
 * 2. Or the element with the largest visual area and prominent contrast
 */
export function detectPrimaryCTA(elements = []) {
  if (!elements || elements.length === 0) return null;

  const intentWords = ['buy', 'order', 'checkout', 'cart', 'sign up', 'signup', 'register', 'get started', 'contact', 'create account', 'proceed'];

  // 1. Text keyword match
  for (const el of elements) {
    const text = (el.name || '').toLowerCase();
    if (intentWords.some((w) => text.includes(w))) {
      return el;
    }
  }

  // 2. Fallback to largest button
  const buttons = elements.filter((el) => el.role === 'button' || el.tag === 'button');
  if (buttons.length > 0) {
    buttons.sort((a, b) => ((b.bbox?.w || 0) * (b.bbox?.h || 0)) - ((a.bbox?.w || 0) * (a.bbox?.h || 0)));
    return buttons[0];
  }

  return elements[0] || null;
}

/**
 * Aggregate run-level metrics across all sessions.
 * All frustration values are strictly normalized to 0-100.
 */
export function buildRunMetrics(sessions = []) {
  if (!sessions.length) {
    return {
      schemaVersion: 2,
      taskSuccessRate: 0,
      avgFrustration: 0,
      avgSessionTime: 0,
      ctaMissRate: 0,
      frictionScore: 0,
      completedCount: 0,
      gaveUpCount: 0,
      totalSessions: 0,
      dropOffStep: null,
      heatmapPoints: [],
      frictionReport: { rageClicks: [], deadClicks: [], loops: [], deadEnds: [], frictionScore: 0 },
    };
  }

  const completed = sessions.filter((s) => s.outcome === 'completed');
  const gaveUp = sessions.filter((s) => s.outcome === 'gave_up' || s.outcome === 'failed' || s.outcome === 'abandoned');
  const totalSessions = sessions.length;

  const taskSuccessRate = Math.round((completed.length / totalSessions) * 100);

  // Average frustration strictly 0-100
  const totalFrustration = sessions.reduce((sum, s) => sum + (s.frustrationScore || 0), 0);
  const avgFrustration = Math.round(totalFrustration / totalSessions);

  // Average duration
  const validTimes = sessions.map((s) => s.totalTime).filter((t) => typeof t === 'number' && t > 0);
  const avgSessionTime = validTimes.length
    ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
    : 0;

  // ctaMissRate: % of sessions that never clicked primary CTA or reached goal
  const missedCTACount = sessions.filter((s) => s.missedCTA).length;
  const ctaMissRate = Math.round((missedCTACount / totalSessions) * 100);

  const allSteps = sessions.flatMap((s) => s.steps || []);
  const frictionReport = detectFriction(allSteps, totalSessions, gaveUp.length);
  const heatmapPoints = buildHeatmapPoints(allSteps);

  return {
    schemaVersion: 2,
    taskSuccessRate,
    avgFrustration,
    avgSessionTime,
    ctaMissRate,
    frictionScore: frictionReport.frictionScore,
    completedCount: completed.length,
    gaveUpCount: gaveUp.length,
    totalSessions,
    heatmapPoints,
    frictionReport,
  };
}

/**
 * Group sessions by persona tag and calculate success rate and 0-100 avg frustration.
 */
export function buildPerPersonaTypeScores(sessions = []) {
  if (!sessions.length) return [];

  const byTag = {};

  for (const sess of sessions) {
    const tag = sess.personaSnapshot?.tag || 'General';
    if (!byTag[tag]) byTag[tag] = { completed: 0, total: 0, frustrationSum: 0 };
    byTag[tag].total++;
    if (sess.outcome === 'completed') byTag[tag].completed++;
    byTag[tag].frustrationSum += (sess.frustrationScore || 0);
  }

  return Object.entries(byTag).map(([tag, data]) => ({
    tag,
    successRate: Math.round((data.completed / data.total) * 100),
    avgFrustration: Math.round(data.frustrationSum / data.total),
    sessionCount: data.total,
  }));
}

/**
 * Build Funnel based on distinct page paths visited with session counts per path.
 */
export function buildDropOffFunnel(sessions = []) {
  if (!sessions.length) return [];

  const totalSessions = sessions.length;
  // Map of pathname -> Set of sessionIds that reached it
  const pathSessionMap = new Map();
  const pathOrder = [];

  for (const session of sessions) {
    const sId = session._id?.toString() || session.id;
    const steps = session.steps || [];

    const visitedInSession = new Set();
    for (const step of steps) {
      if (!step.url) continue;
      let pathname = '/';
      try {
        const u = new URL(step.url);
        pathname = u.pathname || '/';
      } catch {
        pathname = step.url;
      }

      if (!visitedInSession.has(pathname)) {
        visitedInSession.add(pathname);
        if (!pathSessionMap.has(pathname)) {
          pathSessionMap.set(pathname, new Set());
          pathOrder.push(pathname);
        }
        pathSessionMap.get(pathname).add(sId);
      }
    }
  }

  // If no steps had URLs (e.g. initial state), create a fallback root stage
  if (pathOrder.length === 0) {
    return [{
      stage: 'Landing Page (/)',
      count: totalSessions,
      pct: 100,
    }];
  }

  return pathOrder.map((pathname, idx) => {
    const count = pathSessionMap.get(pathname)?.size || 0;
    const label = pathname === '/'
      ? 'Landing Page (/)'
      : pathname.slice(1).replace(/[-_/]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ` (${pathname})`;

    return {
      stage: label,
      count,
      pct: Math.round((count / totalSessions) * 100),
    };
  });
}

export default {
  detectRageClicks,
  detectDeadClicks,
  detectLoops,
  detectDeadEnds,
  computeFrictionScore,
  detectFriction,
  buildHeatmapPoints,
  detectPrimaryCTA,
  buildRunMetrics,
  buildPerPersonaTypeScores,
  buildDropOffFunnel,
};
