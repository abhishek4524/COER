/**
 * api.js — Centralized Data Access Layer
 * Supports real Express server REST calls with graceful fallback to mock data
 * ONLY when VITE_USE_MOCK="true".
 * When VITE_USE_MOCK="false", all requests are sent to real backend with credentials.
 */

import { all50Personas, personasData } from '../mock/personas.js';
import {
  allSessions,
  runMetrics,
  funnelData,
  allRuns,
  personaGroups,
  insightsData,
  generateHeatmapPoints,
} from '../mock/sessions.js';
import { testedScreens, generateReplayEvents } from '../mock/heatmapData.js';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─── Normalizers ─────────────────────────────────────────────────────────────

export function normalizePersona(p) {
  if (!p) return null;
  const id = p._id?.toString() || p.id?.toString();
  const traits = p.traits || {};
  const ageGroup = traits.ageGroup || p.tag || 'general';

  const defaultAvatar = p.avatarSet?.default || p.avatar || `/assets/personas/default.png`;
  const hoverAvatar = p.avatarSet?.hover || p.avatarSet?.confused || p.altAvatar || defaultAvatar;

  return {
    id,
    _id: id,
    name: p.name || 'Anonymous Tester',
    age: p.age || 30,
    role: p.role || (ageGroup === 'teen' ? 'Gen-Z Native' : ageGroup === 'senior' ? 'Senior User' : 'Web User'),
    device: p.device || traits.device || 'Desktop Chrome',
    patience: p.patience ?? traits.patience ?? 50,
    techSavvy: p.techSavvy ?? traits.techSavviness ?? 50,
    tag: p.tag || (ageGroup === 'teen' ? 'Gen-Z' : ageGroup === 'senior' ? 'Senior' : ageGroup === 'young-adult' ? 'Millennial' : 'Casual'),
    color: p.color || '#6C63FF',
    avatar: defaultAvatar,
    altAvatar: hoverAvatar,
    avatarSet: p.avatarSet,
    traits: traits,
    frictionPoint: p.frictionPoint || p.backstory || 'Gets disoriented by confusing flows',
    backstory: p.backstory || '',
    systemPrompt: p.systemPrompt || '',
  };
}

export function normalizeSession(s) {
  if (!s) return null;
  const id = s._id?.toString() || s.id?.toString();
  const persona = s.personaId && typeof s.personaId === 'object'
    ? normalizePersona(s.personaId)
    : s.personaSnapshot
      ? normalizePersona({ ...s.personaSnapshot, id: s.personaId })
      : { id: s.personaId, name: 'Tester', avatar: '/assets/personas/default.png', color: '#6C63FF' };

  return {
    id,
    _id: id,
    runId: s.runId?._id?.toString() || s.runId?.toString() || s.runId,
    personaId: persona.id,
    persona,
    outcome: s.outcome || 'in_progress',
    status: s.outcome === 'completed' ? 'converted' : s.outcome === 'gave_up' ? 'abandoned' : 'active',
    totalTime: s.totalTime || 0,
    frustrationScore: s.frustrationScore || 0,
    finalFeedback: s.finalFeedback || '',
    clickCount: s.clickCount || 0,
    rageClickCount: s.rageClickCount || 0,
    missedCTA: s.missedCTA || false,
    steps: (s.steps || []).map((step, idx) => ({
      step: idx + 1,
      label: step.target ? `${step.action.toUpperCase()} ${step.target}` : step.action,
      duration: Math.round(step.duration || 2),
      expression: step.emotion || 'neutral',
      frustration: step.frustration || 0,
      thought: step.thought || '',
      action: step.action,
      target: step.target,
      screenshot: step.screenshotUrl || step.screenshot || '/assets/steps/product.png',
      screenshotUrl: step.screenshotUrl || step.screenshot,
      x: step.x,
      y: step.y,
    })),
  };
}

// ─── Personas API ────────────────────────────────────────────────────────────

export const getPersonas = async () => {
  if (USE_MOCK) return all50Personas;
  try {
    const res = await fetch(`${API_URL}/personas?limit=50`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data.map(normalizePersona);
    }
    return [];
  } catch (err) {
    console.warn('[api] getPersonas error:', err.message);
    return [];
  }
};

export const getPersonaById = async (id) => {
  if (USE_MOCK) return all50Personas.find(p => p.id === id) ?? null;
  try {
    const res = await fetch(`${API_URL}/personas/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data) {
      return normalizePersona(json.data);
    }
    return null;
  } catch (err) {
    console.warn('[api] getPersonaById error:', err.message);
    return null;
  }
};

export const getPersonaGroups = async () => {
  return personaGroups;
};

// ─── Sessions API ────────────────────────────────────────────────────────────

export const getSessions = async (runId) => {
  if (USE_MOCK || !runId) {
    return runId ? allSessions.filter(s => s.runId === runId) : allSessions;
  }
  try {
    const res = await fetch(`${API_URL}/runs/${runId}/sessions`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      const populated = await Promise.all(
        json.data.map(async (sess) => {
          try {
            const stepsRes = await fetch(`${API_URL}/sessions/${sess._id}/steps`, { credentials: 'include' });
            const stepsJson = await stepsRes.json();
            return normalizeSession({ ...sess, steps: stepsJson.data || [] });
          } catch {
            return normalizeSession(sess);
          }
        })
      );
      return populated;
    }
    return [];
  } catch (err) {
    console.warn('[api] getSessions error:', err.message);
    return [];
  }
};

export const getSessionByPersonaId = async (personaId, runId) => {
  if (USE_MOCK) return allSessions.find(s => s.personaId === personaId) ?? null;
  try {
    const query = new URLSearchParams();
    if (personaId) query.set('personaId', personaId);
    if (runId) query.set('runId', runId);

    const res = await fetch(`${API_URL}/sessions?${query.toString()}`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data?.[0]) {
        const sess = json.data[0];
        const stepsRes = await fetch(`${API_URL}/sessions/${sess._id}/steps`, { credentials: 'include' });
        const stepsJson = await stepsRes.json().catch(() => ({ data: [] }));
        return normalizeSession({ ...sess, steps: stepsJson.data || [] });
      }
    }
    return null;
  } catch (err) {
    console.warn('[api] getSessionByPersonaId error:', err.message);
    return null;
  }
};

// ─── Runs API ────────────────────────────────────────────────────────────────

export const getRuns = async () => {
  if (USE_MOCK) return allRuns;
  try {
    const res = await fetch(`${API_URL}/runs?limit=20`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data.map(r => ({
        id: r._id,
        _id: r._id,
        url: r.url,
        goal: r.goal,
        status: r.status,
        personaCount: r.personaCount,
        device: r.device,
        scores: r.scores,
        summary: r.summary,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      }));
    }
    return [];
  } catch (err) {
    console.warn('[api] getRuns error:', err.message);
    return [];
  }
};

export const getRunById = async (id) => {
  if (USE_MOCK || !id || id === 'run-2024-001') {
    return allRuns.find(r => r.id === id) ?? allRuns[0];
  }
  try {
    const res = await fetch(`${API_URL}/runs/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data) {
      const r = json.data;
      return {
        id: r._id,
        _id: r._id,
        url: r.url,
        goal: r.goal,
        status: r.status,
        personaCount: r.personaCount,
        device: r.device,
        scores: r.scores,
        summary: r.summary,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      };
    }
    return null;
  } catch (err) {
    console.warn('[api] getRunById error:', err.message);
    return null;
  }
};

// ─── Single Source of Truth: Run Report API ─────────────────────────────────

export const getRunReport = async (runId) => {
  if (USE_MOCK || !runId || runId === 'run-2024-001') {
    return {
      run: allRuns[0],
      metrics: runMetrics,
      funnel: funnelData.map(f => ({ stage: f.label || f.stage, count: f.count, pct: f.pct })),
      insights: insightsData.map((ins, idx) => ({ ...ins, id: `ins-${idx}` })),
      personaTypeScores: [
        { tag: 'Gen-Z', successRate: 75, avgFrustration: 25, sessionCount: 15 },
        { tag: 'Senior', successRate: 40, avgFrustration: 60, sessionCount: 10 },
      ],
      sessions: allSessions.map(normalizeSession),
      screens: testedScreens,
      heatmapPoints: generateHeatmapPoints(60),
    };
  }

  try {
    const res = await fetch(`${API_URL}/runs/${runId}/report`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data) {
      const d = json.data;
      return {
        run: d.run,
        metrics: d.metrics,
        insights: d.insights || [],
        funnel: d.funnel || [],
        personaTypeScores: d.personaTypeScores || [],
        sessions: (d.sessions || []).map(normalizeSession),
        screens: (d.screens || []).map((scr, idx) => ({
          ...scr,
          id: scr.id || `scr-${idx}`,
          label: scr.label || scr.name || `Screen ${idx + 1}`,
          screenshot: scr.screenshot || '/assets/steps/product.png',
          thumbnail: scr.thumbnail || scr.screenshot || '/assets/steps/product.png',
        })),
        heatmapPoints: d.heatmapPoints || [],
      };
    }
    return null;
  } catch (err) {
    console.warn('[api] getRunReport error:', err.message);
    return null;
  }
};

export const getRunMetrics = async (runId) => {
  if (USE_MOCK || !runId || runId === 'run-2024-001') return runMetrics;
  try {
    const run = await getRunById(runId);
    if (!run || !run.summary) return null;

    const s = run.summary;
    const taskSuccessRate = s.taskSuccessRate ?? run.scores?.taskSuccessRate ?? 0;
    const avgFrustration = s.avgFrustration ?? run.scores?.avgFrustration ?? 0;
    const ctaMissRate = s.ctaMissRate ?? run.scores?.ctaMissRate ?? 0;
    const avgSessionTime = s.avgSessionTime ?? run.scores?.avgSessionTime ?? 0;

    if (s.totalSessions === 0 && taskSuccessRate === 0) return null;

    return {
      taskSuccessRate,
      avgFrustration,
      ctaMissRate,
      avgSessionTime,
      sparklines: {
        taskSuccess: [
          { value: Math.max(0, taskSuccessRate - 15) },
          { value: Math.max(0, taskSuccessRate - 8) },
          { value: Math.max(0, taskSuccessRate - 3) },
          { value: taskSuccessRate },
        ],
        frustration: [
          { value: Math.max(0, avgFrustration - 10) },
          { value: Math.min(100, avgFrustration + 5) },
          { value: Math.min(100, avgFrustration + 12) },
          { value: avgFrustration },
        ],
        dropOff: [
          { value: Math.min(100, ctaMissRate + 15) },
          { value: Math.min(100, ctaMissRate + 8) },
          { value: Math.max(0, ctaMissRate + 2) },
          { value: ctaMissRate },
        ],
        sessionTime: [
          { value: Math.max(10, avgSessionTime - 20) },
          { value: Math.max(10, avgSessionTime - 10) },
          { value: Math.max(10, avgSessionTime + 5) },
          { value: avgSessionTime },
        ],
      },
    };
  } catch (err) {
    console.warn('[api] getRunMetrics error:', err.message);
    return null;
  }
};

export const getFunnelData = async (runId) => {
  if (USE_MOCK || !runId || runId === 'run-2024-001') return funnelData;
  try {
    const run = await getRunById(runId);
    if (run?.summary?.funnel && Array.isArray(run.summary.funnel) && run.summary.funnel.length > 0) {
      return run.summary.funnel.map(f => ({
        stage: f.label || `Step ${f.step + 1}`,
        count: f.count,
        pct: f.pct,
      }));
    }
    return null;
  } catch (err) {
    console.warn('[api] getFunnelData error:', err.message);
    return null;
  }
};

export const getInsights = async (runId) => {
  if (USE_MOCK || !runId || runId === 'run-2024-001') return insightsData;
  try {
    const run = await getRunById(runId);
    if (run?.summary?.topIssues && Array.isArray(run.summary.topIssues) && run.summary.topIssues.length > 0) {
      return run.summary.topIssues.map((issue, idx) => ({
        id: `ins-real-${idx}`,
        icon: issue.severity === 'critical' ? 'AlertTriangle' : issue.severity === 'high' ? 'Zap' : 'MessageSquare',
        severity: issue.severity,
        issue: issue.title,
        detail: issue.description,
        suggestedFix: issue.suggestedFix,
        affectedCount: issue.affectedCount || 1,
        affectedPersonaIds: [],
      }));
    }
    return null;
  } catch (err) {
    console.warn('[api] getInsights error:', err.message);
    return null;
  }
};

// ─── Heatmap & Screen Data ───────────────────────────────────────────────────

export const getTestedScreens = async (runId) => {
  if (USE_MOCK || !runId || runId === 'run-2024-001') return testedScreens;
  try {
    const res = await fetch(`${API_URL}/runs/${runId}/screens`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((scr, idx) => {
          const clickPoints = scr.clickPoints || [];
          const hotspots = (scr.hotspots && scr.hotspots.length > 0)
            ? scr.hotspots
            : clickPoints.map((pt, pIdx) => ({
                id: `hs-${pIdx}`,
                cx: pt.x,
                cy: pt.y,
                baseClicks: 15,
                rageClicks: pt.type === 'rage' ? 10 : 0,
                type: pt.type,
                label: `Interaction (${pt.x}, ${pt.y})`,
              }));

          return {
            ...scr,
            id: scr.id || `scr-${idx}`,
            label: scr.label || scr.name || `Screen ${idx + 1}`,
            screenshot: scr.screenshot || '/assets/steps/product.png',
            thumbnail: scr.thumbnail || scr.screenshot || '/assets/steps/product.png',
            topHotspot: scr.topHotspot || (hotspots[0] ? { label: scr.label, x: hotspots[0].cx, y: hotspots[0].cy, density: '85%', clicks: clickPoints.length } : null),
            suggestedFix: scr.suggestedFix || 'Simplify navigation and increase contrast on primary action buttons.',
            affectedCount: scr.affectedCount || Math.max(1, (scr.rageClusters?.length || 0) + (scr.deadClickPoints?.length || 0)),
            hotspots,
          };
        });
      }
    }
    return [];
  } catch (err) {
    console.warn('[api] getTestedScreens error:', err.message);
    return [];
  }
};

export const getScreenHeatmapData = async (screenId = 'otp', { personaType = 'all', outcome = 'all' } = {}, runId) => {
  if (USE_MOCK || !runId || runId === 'run-2024-001') {
    const screen = testedScreens.find(s => s.id === screenId) || testedScreens[3];
    return { ...screen, screenId: screen.id };
  }
  try {
    const screens = await getTestedScreens(runId);
    const screen = screens.find(s => s.id === screenId) || screens[0];
    if (screen) return { ...screen, screenId: screen.id };
    return null;
  } catch (err) {
    console.warn('[api] getScreenHeatmapData error:', err.message);
    return null;
  }
};

export const getScreenReplayEvents = async (screenId = 'otp', runId) => {
  return generateReplayEvents(screenId);
};

export const getHeatmapPoints = async (runId, filter = 'all') => {
  if (USE_MOCK || !runId || runId === 'run-2024-001') {
    const points = generateHeatmapPoints(140);
    return filter === 'all' ? points : points.filter(p => p.type === filter);
  }
  try {
    const run = await getRunById(runId);
    const points = run?.summary?.heatmapPoints;
    if (Array.isArray(points) && points.length > 0) {
      return filter === 'all' ? points : points.filter(p => p.type === filter);
    }
    return [];
  } catch {
    return [];
  }
};

// ─── Submit new run ──────────────────────────────────────────────────────────

export const submitNewRun = async (config) => {
  if (USE_MOCK) {
    return {
      success: true,
      runId: `run-${Date.now()}`,
      estimatedSeconds: config.personaCount * 12,
      config,
    };
  }
  try {
    const res = await fetch(`${API_URL}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

    const runId = json.data?._id || json.data?.id;
    return {
      success: true,
      runId,
      data: json.data,
      verificationToken: json.verificationToken,
      estimatedSeconds: config.personaCount * 10,
      config,
    };
  } catch (err) {
    console.error('[api] submitNewRun failed:', err.message);
    return {
      success: false,
      error: err.message || 'Could not connect to server. Is it running on port 5000?',
    };
  }
};

// ─── Projects API ─────────────────────────────────────────────────────────────

export const getProjects = async () => {
  if (USE_MOCK) return [];
  try {
    const res = await fetch(`${API_URL}/projects`, { credentials: 'include' });
    const json = await res.json();
    return json.projects || [];
  } catch (err) {
    console.warn('[api] getProjects error:', err.message);
    return [];
  }
};

export const createProject = async (data) => {
  try {
    const res = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create project');
    return json.project;
  } catch (err) {
    throw err;
  }
};

export const updateProject = async (id, data) => {
  try {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update project');
    return json.project;
  } catch (err) {
    throw err;
  }
};

export const deleteProject = async (id) => {
  try {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to delete project');
    return true;
  } catch (err) {
    throw err;
  }
};

// ─── Notifications API ───────────────────────────────────────────────────────

export const getNotifications = async () => {
  if (USE_MOCK) return { notifications: [], unreadCount: 0 };
  try {
    const res = await fetch(`${API_URL}/notifications`, { credentials: 'include' });
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('[api] getNotifications error:', err.message);
    return { notifications: [], unreadCount: 0 };
  }
};

export const markNotificationRead = async (id) => {
  try {
    const res = await fetch(`${API_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    });
    return await res.json();
  } catch (err) {
    console.warn('[api] markNotificationRead error:', err.message);
  }
};

export const markAllNotificationsRead = async () => {
  try {
    const res = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'POST',
      credentials: 'include',
    });
    return await res.json();
  } catch (err) {
    console.warn('[api] markAllNotificationsRead error:', err.message);
  }
};

// ─── Admin API ───────────────────────────────────────────────────────────────

export const getAdminStats = async () => {
  try {
    const res = await fetch(`${API_URL}/admin/stats`, { credentials: 'include' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch admin stats');
    return json;
  } catch (err) {
    throw err;
  }
};

export const updateUserRole = async (userId, role) => {
  try {
    const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update user role');
    return json.user;
  } catch (err) {
    throw err;
  }
};

// ─── Sharing & Run Management ───────────────────────────────────────────────

export const generateShareToken = async (runId, expiresAt = null) => {
  try {
    const res = await fetch(`${API_URL}/runs/${runId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ expiresAt }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create share link');
    return json;
  } catch (err) {
    throw err;
  }
};

export const revokeShareToken = async (runId) => {
  try {
    const res = await fetch(`${API_URL}/runs/${runId}/share`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to revoke share link');
    return json;
  } catch (err) {
    throw err;
  }
};

export const getSharedReport = async (token) => {
  try {
    const res = await fetch(`${API_URL}/shared/${token}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Shared report unavailable');
    return json.data;
  } catch (err) {
    throw err;
  }
};

export const deleteRun = async (runId) => {
  try {
    const res = await fetch(`${API_URL}/runs/${runId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to delete run');
    return true;
  } catch (err) {
    throw err;
  }
};

// ─── Settings & API Keys ─────────────────────────────────────────────────────

export const updateUserSettings = async (settings) => {
  try {
    const res = await fetch(`${API_URL}/auth/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update settings');
    return json.settings;
  } catch (err) {
    throw err;
  }
};

export const generateApiKey = async (name) => {
  try {
    const res = await fetch(`${API_URL}/auth/api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to generate API key');
    return json;
  } catch (err) {
    throw err;
  }
};

export const revokeApiKey = async (keyId) => {
  try {
    const res = await fetch(`${API_URL}/auth/api-key/${keyId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to revoke API key');
    return true;
  } catch (err) {
    throw err;
  }
};

// ─── Fix Emulator API ─────────────────────────────────────────────────────────

const MOCK_FIXES = [
  {
    id: 'mock-fix-1', runId: 'mock', pagePath: '/',
    title: 'Make primary CTA button visible and high-contrast',
    problem: 'Primary call-to-action is tiny (9px, cream on white) — 3/3 personas missed it.',
    evidence: { page: '/', element: '.btn-proceed', personasAffected: 3, metric: 'CTA miss: 3 personas' },
    severity: 'critical',
    patchOps: [{ type: 'setStyle', selector: '.btn-proceed', cssProps: { background: '#6C63FF', color: '#FFFFFF', fontSize: '16px', fontWeight: '600', padding: '14px 28px', borderRadius: '8px', display: 'inline-block' } }],
    codeSnippet: '.btn-proceed {\n  background: #6C63FF;\n  color: #fff;\n  font-size: 16px;\n  font-weight: 600;\n  padding: 14px 28px;\n  border-radius: 8px;\n}',
    confidence: 0.97, effort: 'low',
    expectedImpact: 'CTA becomes discoverable — projected +30–60% conversion.',
    source: 'deterministic', previewAvailable: true,
  },
  {
    id: 'mock-fix-2', runId: 'mock', pagePath: '/',
    title: 'Replace jargon with plain language',
    problem: '"Initiate SKU Acquirement Workflow" confuses all non-technical users.',
    evidence: { page: '/', element: '.btn-proceed', personasAffected: 3, metric: 'Jargon detected' },
    severity: 'high',
    patchOps: [{ type: 'setText', selector: '.btn-proceed', text: 'Buy Now' }],
    codeSnippet: '<a class="btn-proceed">Buy Now</a>',
    confidence: 0.88, effort: 'low',
    expectedImpact: 'Users immediately understand the action.',
    source: 'deterministic', previewAvailable: true,
  },
  {
    id: 'mock-fix-3', runId: 'mock', pagePath: '/signup',
    title: 'Add visible label to email field',
    problem: 'Email field has no label — only a vague placeholder.',
    evidence: { page: '/signup', element: 'input.input-no-label', personasAffected: 2, metric: 'Missing label (WCAG 1.3.1)' },
    severity: 'high',
    patchOps: [{ type: 'addLabel', selector: 'input.input-no-label', text: 'Email address' }, { type: 'setAttribute', selector: 'input.input-no-label', name: 'aria-label', value: 'Email address' }],
    codeSnippet: '<label for="email">Email address</label>\n<input id="email" type="email" />',
    confidence: 0.9, effort: 'low',
    expectedImpact: 'Eliminates confusion; screen-reader accessible.',
    source: 'deterministic', previewAvailable: true,
  },
  {
    id: 'mock-fix-4', runId: 'mock', pagePath: '/checkout',
    title: 'Style checkout button as primary action',
    problem: '"Proceed to Fulfilment Matrix" button looks disabled (grey) — users assume it\'s inactive.',
    evidence: { page: '/checkout', element: '.btn-fulfilment', personasAffected: 3, metric: 'Perceived disabled' },
    severity: 'critical',
    patchOps: [{ type: 'setStyle', selector: '.btn-fulfilment', cssProps: { background: '#6C63FF', color: '#fff', fontSize: '16px', fontWeight: '600', padding: '14px 24px', borderRadius: '8px', cursor: 'pointer', width: '100%', border: 'none', opacity: '1' } }],
    codeSnippet: '.btn-fulfilment {\n  background: #6C63FF;\n  color: #fff;\n  font-size: 16px;\n  font-weight: 600;\n  padding: 14px 24px;\n  border-radius: 8px;\n  cursor: pointer;\n}',
    confidence: 0.95, effort: 'low',
    expectedImpact: 'Checkout abandonment drops significantly.',
    source: 'deterministic', previewAvailable: true,
  },
];

export const getRunFixes = async (runId) => {
  if (USE_MOCK || !runId) {
    return { fixes: MOCK_FIXES, previewable: true, childRunId: null, generatedAt: new Date().toISOString() };
  }
  try {
    const res = await fetch(`${API_URL}/runs/${runId}/fixes`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data) return json.data;
    return null;
  } catch (err) {
    console.warn('[api] getRunFixes error:', err.message);
    return null;
  }
};

export const previewFixes = async (runId, { enabledFixIds, pagePath }) => {
  if (USE_MOCK) {
    return { beforeUrl: '/assets/steps/product.png', afterUrl: '/assets/steps/product.png', bboxes: [{ fixId: 'mock-fix-1', fixTitle: 'CTA fix', selector: '.btn-proceed', bbox: { x: 220, y: 310, width: 180, height: 36 } }], feasible: true, reason: null };
  }
  try {
    const res = await fetch(`${API_URL}/runs/${runId}/fixes/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ enabledFixIds, pagePath }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (err) {
    console.warn('[api] previewFixes error:', err.message);
    return null;
  }
};

export const retestWithFixes = async (runId, { enabledFixIds }) => {
  if (USE_MOCK) {
    return { childRunId: `mock-child-${Date.now()}`, parentRunId: runId, simulated: true, status: 'running' };
  }
  try {
    const res = await fetch(`${API_URL}/runs/${runId}/fixes/retest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ enabledFixIds }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (err) {
    console.warn('[api] retestWithFixes error:', err.message);
    return null;
  }
};

export const exportFixes = async (runId) => {
  try {
    const res = await fetch(`${API_URL}/runs/${runId}/fixes/export`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[api] exportFixes error:', err.message);
    return null;
  }
};
