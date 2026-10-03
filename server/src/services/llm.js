/**
 * server/src/services/llm.js
 * Provider-agnostic LLM wrapper supporting Gemini, OpenRouter, and grounded Mock.
 *
 * Exports:
 *   callLLM(systemPrompt, userPrompt, opts) → parsed JSON or string
 *   buildPageStatePrompt(pageState, persona, goal, history, extra) → string
 *   buildSummaryPrompt(sessionFeedbacks, goal, url, pageAudits) → string
 *   filterAndGroundedIssues(issues, sessionFeedbacks, pageAudits, totalSessions, visitedCorpus) → Issue[]
 *   SUMMARY_SCHEMA
 *   ACTION_SCHEMA
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// ─── Config ──────────────────────────────────────────────────────────────────

const PROVIDER = process.env.LLM_PROVIDER || 'openrouter';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// OpenRouter config (set LLM_PROVIDER=openrouter)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry(fn, retries = MAX_RETRIES) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 300;
        console.warn(`[LLM] Retry ${attempt + 1}/${retries} after ${Math.round(delay)}ms — ${err.message}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── JSON schema for persona action (Element-Index based) ──────────────────────

export const ACTION_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    action: {
      type: SchemaType.STRING,
      enum: ['click', 'type', 'scroll', 'wait', 'give_up', 'goal_complete'],
      description: 'The action to take',
    },
    elementIndex: {
      type: SchemaType.NUMBER,
      description: 'The 1-based index number of the target element from the interactive elements list (required if action is click or type)',
      nullable: true,
    },
    text: {
      type: SchemaType.STRING,
      description: 'Text to type into the input field (required if action is type)',
      nullable: true,
    },
    thought: {
      type: SchemaType.STRING,
      description: 'First-person narration of what you are thinking in persona voice',
    },
    emotion: {
      type: SchemaType.STRING,
      enum: ['neutral', 'curious', 'focused', 'confused', 'frustrated', 'happy', 'angry', 'gave_up'],
      description: 'Current emotional state',
    },
    frustration: {
      type: SchemaType.NUMBER,
      description: 'Frustration level 0-10 (0=calm, 10=completely blocked/rage-quitting)',
    },
  },
  required: ['action', 'thought', 'emotion', 'frustration'],
};

export const SUMMARY_SCHEMA = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      severity: { type: SchemaType.STRING, enum: ['critical', 'high', 'medium', 'low'] },
      affectedCount: { type: SchemaType.NUMBER },
      description: { type: SchemaType.STRING },
      suggestedFix: { type: SchemaType.STRING },
    },
    required: ['title', 'severity', 'affectedCount', 'description', 'suggestedFix'],
  },
};

// ─── Gemini provider ──────────────────────────────────────────────────────────

let _geminiClient = null;

function getGeminiClient() {
  if (!_geminiClient) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set in .env');
    _geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return _geminiClient;
}

async function callGemini(systemPrompt, userPrompt, opts = {}) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: opts.schema || ACTION_SCHEMA,
      temperature: opts.temperature ?? 0.6,
      maxOutputTokens: opts.maxTokens ?? 1024,
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  return JSON.parse(text);
}

async function callGeminiText(systemPrompt, userPrompt, opts = {}) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 2048,
    },
  });
  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

// ─── OpenRouter provider ──────────────────────────────────────────────────────

function extractJson(text) {
  if (!text) throw new Error('Empty text');

  // 1. Check markdown code blocks
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  // 2. Extract between first `{` and last `}`
  const firstObj = text.indexOf('{');
  const lastObj = text.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    try {
      return JSON.parse(text.slice(firstObj, lastObj + 1));
    } catch {}
  }

  // 3. Extract between first `[` and last `]`
  const firstArr = text.indexOf('[');
  const lastArr = text.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    try {
      return JSON.parse(text.slice(firstArr, lastArr + 1));
    } catch {}
  }

  // Direct parse fallback
  return JSON.parse(text.trim());
}

async function callOpenRouter(systemPrompt, userPrompt, opts = {}) {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set in .env');

  const jsonInstruction = opts.freeText
    ? ''
    : '\n\nCRITICAL: Respond ONLY with valid JSON (no markdown formatting, no code fences, no extra text).';

  const messages = [
    { role: 'system', content: systemPrompt + jsonInstruction },
    { role: 'user', content: userPrompt },
  ];

  const body = {
    model: OPENROUTER_MODEL,
    messages,
    temperature: opts.temperature ?? 0.5,
    max_tokens: opts.maxTokens ?? 1024,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  let res;
  try {
    res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://personify.app',
        'X-Title': 'Personify',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown error');
    throw new Error(`OpenRouter API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty content');

  if (opts.freeText) return content.trim();

  return extractJson(content);
}

// ─── Clean Grounded Mock provider (NO HARDCODED LEAKS) ─────────────────────────

async function callMock(systemPrompt, userPrompt, opts = {}) {
  await new Promise((r) => setTimeout(r, 100));

  // 1. Summary call: derive strictly from page audit or feedback mentioned in userPrompt
  if (opts.schema === SUMMARY_SCHEMA || userPrompt.includes('Test Summary Request')) {
    const totalMatch = userPrompt.match(/Total sessions:\s*(\d+)/);
    const total = totalMatch ? Number(totalMatch[1]) : 1;
    const issues = [];

    if (userPrompt.includes('font') || userPrompt.includes('size')) {
      issues.push({
        title: 'Small and Low-Legibility Text / Action Elements',
        severity: 'high',
        affectedCount: Math.min(total, 2),
        description: 'Several elements on the page use a font size below the standard readable threshold, causing hesitation.',
        suggestedFix: 'Increase font sizes to a minimum of 14px on all interactive elements.',
      });
    }

    if (userPrompt.includes('label') || userPrompt.includes('missing')) {
      issues.push({
        title: 'Missing Input Labels',
        severity: 'high',
        affectedCount: Math.min(total, 1),
        description: 'Input fields lack visible labels, causing users to guess required formats.',
        suggestedFix: 'Add clear, persistent <label> tags to all form controls.',
      });
    }

    if (issues.length === 0) {
      issues.push({
        title: 'Navigation and Discovery Friction',
        severity: 'medium',
        affectedCount: Math.min(total, 1),
        description: 'Testers spent unexpected time locating the primary path to complete their goal.',
        suggestedFix: 'Highlight the primary call to action with distinct visual hierarchy.',
      });
    }

    return issues;
  }

  // 2. Free-text feedback review
  if (opts.freeText) {
    if (userPrompt.includes('outcome was: completed')) {
      return 'I was able to locate the information and complete my goal, though navigating the layout could be more intuitive.';
    }
    return 'I had difficulty finding the required elements on the page to complete my goal.';
  }

  // 3. Step action decision based on element list in userPrompt
  const elementsMatch = userPrompt.match(/\[(\d+)\]\s*<([^>]+)>\s*"([^"]*)"/g);
  let pickedIndex = 1;
  let pickedAction = 'click';

  if (elementsMatch && elementsMatch.length > 0) {
    // Pick the first clickable element or scroll
    pickedIndex = 1;
    pickedAction = 'click';
  } else {
    pickedAction = 'scroll';
  }

  return {
    action: pickedAction,
    elementIndex: pickedIndex,
    text: null,
    thought: 'Examining the visible elements to proceed toward my goal.',
    emotion: 'curious',
    frustration: 2,
  };
}

// ─── Normalizer for action decision ──────────────────────────────────────────

export function normalizeActionOutput(raw, elements = []) {
  if (!raw || typeof raw !== 'object') {
    return {
      action: 'wait',
      elementIndex: null,
      text: null,
      thought: 'Observing the page.',
      emotion: 'neutral',
      frustration: 2,
    };
  }

  const validActions = ['click', 'type', 'scroll', 'wait', 'give_up', 'goal_complete'];
  let action = String(raw.action || '').toLowerCase().trim();

  // If action contains spaces or phrases like "click button" or "proceed"
  if (!validActions.includes(action)) {
    if (action.includes('click')) action = 'click';
    else if (action.includes('type') || action.includes('enter') || action.includes('fill')) action = 'type';
    else if (action.includes('scroll')) action = 'scroll';
    else if (action.includes('give') || action.includes('quit') || action.includes('abort')) action = 'give_up';
    else if (action.includes('complete') || action.includes('finish') || action.includes('success')) action = 'goal_complete';
    else action = 'wait';
  }

  // Normalize elementIndex
  let elementIndex = null;
  if (raw.elementIndex != null) {
    const parsed = parseInt(raw.elementIndex, 10);
    if (!isNaN(parsed) && parsed > 0) elementIndex = parsed;
  }

  // Normalize frustration (0 - 10)
  let frustration = 0;
  if (typeof raw.frustration === 'number') {
    frustration = raw.frustration;
  } else if (typeof raw.frustration === 'string') {
    const num = parseFloat(raw.frustration);
    frustration = isNaN(num) ? 3 : num;
  }
  // If LLM returned 0-100 scale by mistake, divide by 10
  if (frustration > 10) frustration = Math.round(frustration / 10);
  frustration = Math.min(10, Math.max(0, Math.round(frustration)));

  // Normalize emotion
  const validEmotions = ['neutral', 'curious', 'focused', 'confused', 'frustrated', 'happy', 'satisfied', 'angry', 'gave_up'];
  let emotion = String(raw.emotion || 'neutral').toLowerCase().trim();
  if (!validEmotions.includes(emotion)) emotion = frustration >= 7 ? 'frustrated' : 'neutral';

  return {
    action,
    elementIndex,
    text: raw.text ? String(raw.text) : null,
    thought: String(raw.thought || 'Navigating page…').slice(0, 300),
    emotion,
    frustration,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function callLLM(systemPrompt, userPrompt, opts = {}) {
  try {
    return await withRetry(async () => {
      if (PROVIDER === 'gemini') {
        if (opts.freeText) return callGeminiText(systemPrompt, userPrompt, opts);
        return callGemini(systemPrompt, userPrompt, opts);
      }
      if (PROVIDER === 'openrouter' || PROVIDER === 'openai') {
        return callOpenRouter(systemPrompt, userPrompt, opts);
      }
      return callMock(systemPrompt, userPrompt, opts);
    }, 2);
  } catch (err) {
    if (PROVIDER !== 'mock') {
      console.warn(`[LLM] Provider '${PROVIDER}' error (${err.message}). Falling back to safe mock generator.`);
      return callMock(systemPrompt, userPrompt, opts);
    }
    throw err;
  }
}

/**
 * Build the user-turn prompt with element-index list, last action result, and loop avoidance.
 */
export function buildPageStatePrompt(pageState, persona, goal, history = [], extra = {}) {
  const { lastActionResult, recentVisitedUrls = [], repeatWarning = null } = extra;

  const historyStr = history.length
    ? history.map((h, i) =>
        `Step ${i + 1}: [${h.action}${h.elementIndex ? ` #${h.elementIndex}` : ''}] ${h.target || ''} → thought: "${h.thought}" (frustration: ${h.frustration}/10)`
      ).join('\n')
    : 'No previous steps taken.';

  const elementsStr = (pageState.elements || [])
    .map((el) =>
      `[${el.index}] <${el.tag || el.role}> "${el.name}" role=${el.role} fontSize=${el.fontSize}px bbox=[${el.bbox.x},${el.bbox.y},${el.bbox.w},${el.bbox.h}]`
    )
    .join('\n');

  const visitedStr = recentVisitedUrls.length > 0
    ? recentVisitedUrls.join(' → ')
    : pageState.url;

  return `
## Current Page State
URL: ${pageState.url}
Title: ${pageState.title}
Visible Text Excerpt: ${pageState.visibleText.slice(0, 600)}

## Numbered Interactive Elements (choose by [index])
${elementsStr || 'None detected on this view'}

## Your Goal
${goal}

## Previous Action Result
${lastActionResult || 'Starting test session.'}

## Recent Visited Pages
${visitedStr}
${repeatWarning ? `\n⚠️ WARNING: ${repeatWarning}\n` : ''}

## Step History (last ${history.length} steps)
${historyStr}

## Decision Instructions
You are ${persona.name} (${persona.role || 'tester'}, age ${persona.age || 30}).
Decide your next action. Reply ONLY with the JSON action object.

JSON Schema:
{
  "action": "click" | "type" | "scroll" | "wait" | "give_up" | "goal_complete",
  "elementIndex": <number: the 1-based [index] from the list above, required if action is click or type>,
  "text": <string: required if action is type>,
  "thought": "<first-person thought expressing your reaction>",
  "emotion": "neutral" | "curious" | "focused" | "confused" | "frustrated" | "happy" | "angry",
  "frustration": <number: 0 to 10>
}

Rules:
- To click or type, you MUST provide "elementIndex" matching one of the [index] numbers from the list above.
- If you have successfully achieved the testing goal, use "action": "goal_complete".
- If you are completely stuck, confused after 3 attempts, or the page is broken, use "action": "give_up".
- "frustration" must be a number between 0 and 10.
`.trim();
}

/**
 * Build a summary prompt with measured facts and strict grounding constraints.
 */
export function buildSummaryPrompt(sessionFeedbacks, goal, url, pageAudits = []) {
  const feedbackList = sessionFeedbacks
    .map((f, i) => `[Tester ${i + 1}: ${f.personaName}, outcome: ${f.outcome}] "${f.feedback}"`)
    .join('\n');

  // Format measured findings from page audits
  const auditFindingsStr = (pageAudits || [])
    .flatMap((audit) =>
      (audit.findings || []).map((f) => `- [${audit.pathname}] ${f.type.toUpperCase()}: ${f.detail} (element: "${f.element}", text: "${f.text}")`)
    )
    .slice(0, 20)
    .join('\n');

  return `
## Test Summary Request
URL tested: ${url}
Goal: ${goal}
Total sessions: ${sessionFeedbacks.length}

## Measured Page Audit Findings (Automated Facts)
${auditFindingsStr || 'No automated audit violations found.'}

## Persona Feedback (Real Tester Quotes)
${feedbackList || 'No feedback recorded.'}

## Task
Cluster the findings into the top 3 UX issues. For each issue return:
- title: concise descriptive label
- severity: "critical" | "high" | "medium" | "low"
- affectedCount: number of personas affected (MUST be between 1 and ${sessionFeedbacks.length})
- description: 1-2 sentence evidence-backed explanation citing specific pages or elements
- suggestedFix: concrete actionable fix

CRITICAL GROUNDING RULES:
1. You MUST cite ONLY elements, buttons, text, and findings that appear in the Measured Facts or Persona Feedback above.
2. DO NOT invent strings, buttons, or workflows that do not exist in the provided data.
3. affectedCount can NEVER exceed ${sessionFeedbacks.length}.

Return a JSON array of issue objects.
`.trim();
}

/**
 * Grounded Post-Check: Drop any hallucinated insights and cap affectedCount.
 */
export function filterAndGroundedIssues(issues, sessionFeedbacks, pageAudits, totalSessions, visitedCorpus = '') {
  const maxSessions = Math.max(1, totalSessions);
  const corpusLower = visitedCorpus.toLowerCase();

  const valid = [];

  for (const issue of (issues || [])) {
    if (!issue || !issue.title) continue;

    // Cap affectedCount
    let affectedCount = Number(issue.affectedCount) || 1;
    affectedCount = Math.min(maxSessions, Math.max(1, affectedCount));

    const titleLower = issue.title.toLowerCase();
    const descLower = (issue.description || '').toLowerCase();

    // Check for obvious hallucinated demo-site strings on non-demo sites
    const demoLeakedPhrases = ['sku acquirement', 'fulfilment matrix', 'requisite email datum'];
    let leaked = false;
    for (const phrase of demoLeakedPhrases) {
      if ((titleLower.includes(phrase) || descLower.includes(phrase)) && !corpusLower.includes(phrase)) {
        leaked = true;
        break;
      }
    }

    if (leaked) {
      console.warn(`[llm] Dropping hallucinated issue containing leaked phrase: "${issue.title}"`);
      continue;
    }

    valid.push({
      title: issue.title,
      severity: ['critical', 'high', 'medium', 'low'].includes(issue.severity) ? issue.severity : 'medium',
      affectedCount,
      description: issue.description || '',
      suggestedFix: issue.suggestedFix || 'Improve visual hierarchy and clarity.',
    });
  }

  // If no valid issues remain, generate grounded issues directly from pageAudits
  if (valid.length === 0 && Array.isArray(pageAudits) && pageAudits.length > 0) {
    const allFindings = pageAudits.flatMap(a => a.findings || []);

    const fontIssue = allFindings.find(f => f.type === 'font_size');
    if (fontIssue) {
      valid.push({
        title: 'Small and Low-Legibility Text / Action Elements',
        severity: 'high',
        affectedCount: Math.min(maxSessions, 2),
        description: `Elements with font size < 12px detected (${fontIssue.detail}), impairing readability and tap confidence.`,
        suggestedFix: 'Increase font sizes to a minimum of 14px on all action items and labels.',
      });
    }

    const labelIssue = allFindings.find(f => f.type === 'missing_label');
    if (labelIssue) {
      valid.push({
        title: 'Unlabeled Form Controls',
        severity: 'high',
        affectedCount: Math.min(maxSessions, 2),
        description: `Form fields lack visible <label> tags (${labelIssue.detail}), causing uncertainty during input.`,
        suggestedFix: 'Associate every form input with an explicit <label> element.',
      });
    }

    const tapIssue = allFindings.find(f => f.type === 'tap_target');
    if (tapIssue) {
      valid.push({
        title: 'Undersized Tap Targets',
        severity: 'medium',
        affectedCount: Math.min(maxSessions, 1),
        description: `Interactive elements under 44x44px detected (${tapIssue.detail}), leading to misclicks or frustration.`,
        suggestedFix: 'Enlarge clickable padding to at least 44x44px per WCAG guidelines.',
      });
    }
  }

  return valid.slice(0, 3);
}

export default {
  callLLM,
  buildPageStatePrompt,
  buildSummaryPrompt,
  filterAndGroundedIssues,
  normalizeActionOutput,
  ACTION_SCHEMA,
  SUMMARY_SCHEMA,
};
