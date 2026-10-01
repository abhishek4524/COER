/**
 * api.js — Centralized Data Access Layer
 * Supports real Express server REST calls with graceful fallback to mock data
 * when VITE_USE_MOCK="true" or when the backend is offline.
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
    const res = await fetch(`${API_URL}/personas?limit=50`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data.map(normalizePersona);
    }
    return all50Personas;
  } catch (err) {
    console.warn('[api] getPersonas fallback to mock:', err.message);
    return all50Personas;
  }
};

export const getPersonaById = async (id) => {
  if (USE_MOCK) return all50Personas.find(p => p.id === id) ?? null;
  try {
    const res = await fetch(`${API_URL}/personas/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data) {
      return normalizePersona(json.data);
    }
    return all50Personas.find(p => p.id === id) ?? null;
  } catch (err) {
    console.warn('[api] getPersonaById fallback to mock:', err.message);
    return all50Personas.find(p => p.id === id) ?? null;
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
    const res = await fetch(`${API_URL}/runs/${runId}/sessions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      // Also fetch steps for each session if needed
      const populated = await Promise.all(
        json.data.map(async (sess) => {
          try {
            const stepsRes = await fetch(`${API_URL}/sessions/${sess._id}/steps`);
            const stepsJson = await stepsRes.json();
            return normalizeSession({ ...sess, steps: stepsJson.data || [] });
          } catch {
            return normalizeSession(sess);
          }
        })
      );
      return populated;
    }
    return allSessions.filter(s => s.runId === runId) || allSessions;
  } catch (err) {
    console.warn('[api] getSessions fallback to mock:', err.message);
    return allSessions.filter(s => s.runId === runId) || allSessions;
  }
};

export const getSessionByPersonaId = async (personaId, runId) => {
  if (USE_MOCK) return allSessions.find(s => s.personaId === personaId) ?? null;
  try {
    const query = new URLSearchParams();
    if (personaId) query.set('personaId', personaId);
    if (runId) query.set('runId', runId);

    const res = await fetch(`${API_URL}/sessions?${query.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data?.[0]) {
        const sess = json.data[0];
        const stepsRes = await fetch(`${API_URL}/sessions/${sess._id}/steps`);
        const stepsJson = await stepsRes.json().catch(() => ({ data: [] }));
        return normalizeSession({ ...sess, steps: stepsJson.data || [] });
      }
    }
    return allSessions.find(s => s.personaId === personaId) ?? null;
  } catch (err) {
    console.warn('[api] getSessionByPersonaId fallback to mock:', err.message);
    return allSessions.find(s => s.personaId === personaId) ?? null;
  }
};

// ─── Runs API ────────────────────────────────────────────────────────────────

export const getRuns = async () => {
  if (USE_MOCK) return allRuns;
  try {
    const res = await fetch(`${API_URL}/runs?limit=20`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
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
    return allRuns;
  } catch (err) {
    console.warn('[api] getRuns fallback to mock:', err.message);
    return allRuns;
  }
};

export const getRunById = async (id) => {
  if (USE_MOCK || !id || id === 'run-2024-001') {
    return allRuns.find(r => r.id === id) ?? allRuns[0];
  }
  try {
    const res = await fetch(`${API_URL}/runs/${id}`);
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
    return allRuns[0];
  } catch (err) {
    console.warn('[api] getRunById fallback to mock:', err.message);
    return allRuns.find(r => r.id === id) ?? allRuns[0];
  }
};

// ─── Metrics & Insights ──────────────────────────────────────────────────────

export const getRunMetrics = async (runId) => {
  if (USE_MOCK || !runId || runId === 'run-2024-001') return runMetrics;
  try {
    const run = await getRunById(runId);
    if (!run || !run.summary) return runMetrics;

    const s = run.summary;
    const taskSuccessRate = s.taskSuccessRate ?? run.scores?.taskSuccessRate ?? 50;
    const avgFrustration = s.avgFrustration ?? run.scores?.avgFrustration ?? 40;
    const ctaMissRate = s.ctaMissRate ?? run.scores?.ctaMissRate ?? 25;
    const avgSessionTime = s.avgSessionTime ?? run.scores?.avgSessionTime ?? 60;

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
    console.warn('[api] getRunMetrics fallback to mock:', err.message);
    return runMetrics;
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
    return funnelData;
  } catch (err) {
    console.warn('[api] getFunnelData fallback to mock:', err.message);
    return funnelData;
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
        title: issue.title,
        description: issue.description,
        suggestedFix: issue.suggestedFix,
        affectedCount: issue.affectedCount || 1,
        affectedPersonaIds: ['p1', 'p2', 'p3'],
      }));
    }
    return insightsData;
  } catch (err) {
    console.warn('[api] getInsights fallback to mock:', err.message);
    return insightsData;
  }
};

// ─── Heatmap & Screen Data ───────────────────────────────────────────────────

export const getTestedScreens = async (runId) => {
  if (USE_MOCK || !runId || runId === 'run-2024-001') return testedScreens;
  try {
    const res = await fetch(`${API_URL}/runs/${runId}/screens`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data.map((scr, idx) => ({
          ...scr,
          screenshot: scr.screenshot || testedScreens[idx % testedScreens.length].screenshot,
          thumbnail: scr.thumbnail || testedScreens[idx % testedScreens.length].thumbnail,
          topHotspot: scr.topHotspot || { label: scr.name, x: 600, y: 400, density: '82%', clicks: scr.clickPoints?.length || 15 },
          suggestedFix: scr.suggestedFix || 'Simplify navigation and increase contrast on primary action buttons.',
          affectedCount: scr.affectedCount || Math.min(50, (scr.rageClusters?.length || 1) * 3),
        }));
      }
    }
    return testedScreens;
  } catch (err) {
    console.warn('[api] getTestedScreens fallback to mock:', err.message);
    return testedScreens;
  }
};

export const getScreenHeatmapData = async (screenId = 'otp', { personaType = 'all', outcome = 'all' } = {}, runId) => {
  if (USE_MOCK || !runId || runId === 'run-2024-001') {
    const screen = testedScreens.find(s => s.id === screenId) || testedScreens[3];
    return { ...screen, screenId: screen.id };
  }
  try {
    const screens = await getTestedScreens(runId);
    const screen = screens.find(s => s.id === screenId) || screens[0] || testedScreens[0];
    return { ...screen, screenId: screen.id };
  } catch (err) {
    const screen = testedScreens.find(s => s.id === screenId) || testedScreens[3];
    return { ...screen, screenId: screen.id };
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
    return generateHeatmapPoints(140);
  } catch {
    return generateHeatmapPoints(140);
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
    console.warn('[api] submitNewRun server failed, falling back to mock:', err.message);
    return {
      success: true,
      runId: `mock-run-${Date.now()}`,
      estimatedSeconds: config.personaCount * 12,
      config,
      isFallback: true,
    };
  }
};
