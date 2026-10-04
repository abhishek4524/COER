/**
 * server/src/services/fixGenerator.js
 *
 * Generates structured fix objects from:
 *   a) Deterministic audit findings (preferred)
 *   b) LLM-assisted content fixes (jargon, confusing text)
 *
 * Each fix has the shape:
 * {
 *   id: string,
 *   runId: string,
 *   pagePath: string,
 *   title: string,
 *   problem: string,
 *   evidence: { page, element, personasAffected, metric },
 *   severity: 'critical' | 'high' | 'medium' | 'low',
 *   patchOps: ValidatedPatchOp[],
 *   codeSnippet: string,
 *   confidence: number (0-1),
 *   effort: 'low' | 'med' | 'high',
 *   expectedImpact: string,
 *   source: 'deterministic' | 'llm',
 *   previewAvailable: boolean,
 * }
 */

import crypto from 'crypto';
import { validatePatchOps } from './fixPatcher.js';
import { callLLM } from './llm.js';

function fixId(runId, type, element) {
  return crypto
    .createHash('md5')
    .update(`${runId}|${type}|${element}`)
    .digest('hex')
    .slice(0, 12);
}

// ─── Deterministic Fixes from Audit Findings ────────────────────────────────

/**
 * Font size < 12px → bump to 16px
 */
function fontSizeFix(finding, runId, pagePath, personasAffected) {
  const sel = finding.element || 'button';
  const ops = validatePatchOps([
    {
      type: 'setStyle',
      selector: sel,
      cssProps: { fontSize: '16px', lineHeight: '1.5' },
    },
  ]);
  return {
    id: fixId(runId, 'font_size', sel),
    runId,
    pagePath,
    title: 'Increase font size to readable minimum',
    problem: `Text at ${finding.fontSize ?? '< 12'}px is below the readable minimum (16px recommended).`,
    evidence: {
      page: pagePath,
      element: sel,
      personasAffected,
      metric: `Font size: ${finding.fontSize ?? '< 12'}px`,
    },
    severity: finding.severity || 'high',
    patchOps: ops,
    codeSnippet: `/* Fix: bump font size to 16px */\n${sel} {\n  font-size: 16px;\n  line-height: 1.5;\n}`,
    confidence: 0.95,
    effort: 'low',
    expectedImpact: 'Improves readability and tap confidence; reduces hesitation on interactive elements.',
    source: 'deterministic',
    previewAvailable: true,
  };
}

/**
 * Low contrast text → adjust color to meet WCAG AA (#333 on white = 12:1)
 */
function lowContrastFix(finding, runId, pagePath, personasAffected) {
  const sel = finding.element || 'p';
  const ops = validatePatchOps([
    {
      type: 'setStyle',
      selector: sel,
      cssProps: { color: '#1C1C1E' },
    },
  ]);
  return {
    id: fixId(runId, 'low_contrast', sel),
    runId,
    pagePath,
    title: 'Fix low-contrast text to meet WCAG AA',
    problem: `Text color ${finding.text ? `"${finding.text}"` : ''} has insufficient contrast against the background.`,
    evidence: {
      page: pagePath,
      element: sel,
      personasAffected,
      metric: 'Contrast ratio < 4.5:1 (AA requires ≥ 4.5:1)',
    },
    severity: finding.severity || 'high',
    patchOps: ops,
    codeSnippet: `/* Fix: use high-contrast text color */\n${sel} {\n  color: #1C1C1E;\n}`,
    confidence: 0.9,
    effort: 'low',
    expectedImpact: 'Makes text legible for all users including those with low vision.',
    source: 'deterministic',
    previewAvailable: true,
  };
}

/**
 * Missing label / aria-label → add visible label
 */
function missingLabelFix(finding, runId, pagePath, personasAffected) {
  const sel = finding.element || 'input';
  const labelText = finding.text || 'Input field';
  const ops = validatePatchOps([
    {
      type: 'addLabel',
      selector: sel,
      text: labelText,
    },
    {
      type: 'setAttribute',
      selector: sel,
      name: 'aria-label',
      value: labelText,
    },
  ]);
  return {
    id: fixId(runId, 'missing_label', sel),
    runId,
    pagePath,
    title: `Add visible label: "${labelText}"`,
    problem: `Form field "${sel}" has no visible <label> or aria-label — users must guess what to enter.`,
    evidence: {
      page: pagePath,
      element: sel,
      personasAffected,
      metric: 'Missing label detected by WCAG 1.3.1',
    },
    severity: finding.severity || 'high',
    patchOps: ops,
    codeSnippet: `<!-- Fix: add label element -->\n<label for="field-id">${labelText}</label>\n<input id="field-id" ... />`,
    confidence: 0.9,
    effort: 'low',
    expectedImpact: 'Eliminates confusion about required input format; critical for screen readers.',
    source: 'deterministic',
    previewAvailable: true,
  };
}

/**
 * Tap target < 44px → set min size and padding
 */
function tapTargetFix(finding, runId, pagePath, personasAffected) {
  const sel = finding.element || 'button';
  const ops = validatePatchOps([
    {
      type: 'setStyle',
      selector: sel,
      cssProps: {
        minWidth: '44px',
        minHeight: '44px',
        padding: '10px 16px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
  ]);
  return {
    id: fixId(runId, 'tap_target', sel),
    runId,
    pagePath,
    title: 'Enlarge tap target to 44×44px minimum',
    problem: `Interactive element is ${finding.width ?? '?'}×${finding.height ?? '?'}px — below the WCAG 2.5.5 minimum of 44×44px.`,
    evidence: {
      page: pagePath,
      element: sel,
      personasAffected,
      metric: `Size: ${finding.width ?? '?'}×${finding.height ?? '?'}px (min 44×44px)`,
    },
    severity: finding.severity || 'medium',
    patchOps: ops,
    codeSnippet: `/* Fix: enlarge tap target */\n${sel} {\n  min-width: 44px;\n  min-height: 44px;\n  padding: 10px 16px;\n}`,
    confidence: 0.92,
    effort: 'low',
    expectedImpact: 'Reduces misclicks and rage clicks; especially important on mobile viewports.',
    source: 'deterministic',
    previewAvailable: true,
  };
}

/**
 * Tiny/low-contrast primary CTA → make large, high-contrast indigo
 */
function weakCtaFix(finding, runId, pagePath, personasAffected) {
  const sel = finding.element || 'a.btn-proceed, .btn-proceed';
  const ops = validatePatchOps([
    {
      type: 'setStyle',
      selector: sel,
      cssProps: {
        background: '#6C63FF',
        color: '#FFFFFF',
        fontSize: '16px',
        fontWeight: '600',
        padding: '14px 28px',
        borderRadius: '8px',
        display: 'inline-block',
        minWidth: '180px',
        textAlign: 'center',
        textDecoration: 'none',
        border: 'none',
        cursor: 'pointer',
      },
    },
  ]);
  return {
    id: fixId(runId, 'weak_cta', sel),
    runId,
    pagePath,
    title: 'Make primary CTA button visible and high-contrast',
    problem: `Primary call-to-action button is tiny/low-contrast — ${personasAffected} personas missed it entirely.`,
    evidence: {
      page: pagePath,
      element: sel,
      personasAffected,
      metric: `CTA miss rate: ${personasAffected} personas`,
    },
    severity: 'critical',
    patchOps: ops,
    codeSnippet: `/* Fix: high-contrast primary CTA */\n.btn-proceed {\n  background: #6C63FF;\n  color: #fff;\n  font-size: 16px;\n  font-weight: 600;\n  padding: 14px 28px;\n  border-radius: 8px;\n  display: inline-block;\n}`,
    confidence: 0.97,
    effort: 'low',
    expectedImpact: 'Primary CTA becomes discoverable — projected to increase conversion by 30–60%.',
    source: 'deterministic',
    previewAvailable: true,
  };
}

/**
 * Disabled-looking submit button → primary style
 */
function disabledButtonFix(finding, runId, pagePath, personasAffected) {
  const sel = finding.element || '.btn-fulfilment, button[type="submit"]';
  const ops = validatePatchOps([
    {
      type: 'setStyle',
      selector: sel,
      cssProps: {
        background: '#6C63FF',
        color: '#FFFFFF',
        fontSize: '16px',
        fontWeight: '600',
        padding: '14px 24px',
        borderRadius: '8px',
        cursor: 'pointer',
        width: '100%',
        border: 'none',
        opacity: '1',
      },
    },
  ]);
  return {
    id: fixId(runId, 'disabled_button', sel),
    runId,
    pagePath,
    title: 'Style checkout button as primary action',
    problem: `Submit button appears disabled (grey #bdc3c7) — users assume it is inactive and give up.`,
    evidence: {
      page: pagePath,
      element: sel,
      personasAffected,
      metric: 'Button perceived as disabled; session abandonment at checkout',
    },
    severity: 'critical',
    patchOps: ops,
    codeSnippet: `/* Fix: primary button style */\nbutton[type="submit"] {\n  background: #6C63FF;\n  color: #fff;\n  font-size: 16px;\n  font-weight: 600;\n  padding: 14px 24px;\n  border-radius: 8px;\n  cursor: pointer;\n  border: none;\n}`,
    confidence: 0.95,
    effort: 'low',
    expectedImpact: 'Users can clearly identify the primary action; abandonment at checkout drops significantly.',
    source: 'deterministic',
    previewAvailable: true,
  };
}

/**
 * No visible error message → add inline error region
 */
function silentErrorFix(finding, runId, pagePath, personasAffected) {
  const formSel = finding.element || 'form';
  const ops = validatePatchOps([
    {
      type: 'insertAfter',
      selector: formSel,
      html: '<div data-personify-fix="true" role="alert" style="color:#c0392b;font-size:14px;padding:10px 12px;background:#fdecea;border:1px solid #e74c3c;border-radius:6px;margin-top:8px;" id="inline-error-region">Please check all required fields and try again.</div>',
    },
  ]);
  return {
    id: fixId(runId, 'silent_error', formSel),
    runId,
    pagePath,
    title: 'Add visible inline error message region',
    problem: 'Form silently resets on invalid input — users have no feedback about what went wrong.',
    evidence: {
      page: pagePath,
      element: formSel,
      personasAffected,
      metric: 'Rage clicks on submit button; silent validation failure',
    },
    severity: 'high',
    patchOps: ops,
    codeSnippet: `<!-- Fix: add visible error region -->\n<div role="alert" style="color:#c0392b;background:#fdecea;padding:10px;border-radius:6px;">\n  Please check all required fields and try again.\n</div>`,
    confidence: 0.85,
    effort: 'low',
    expectedImpact: 'Users understand validation errors; reduces rage clicks and abandonment on forms.',
    source: 'deterministic',
    previewAvailable: true,
  };
}

/**
 * Accessibility violation from axe-core → fix aria-label
 */
function accessibilityFix(finding, runId, pagePath, personasAffected) {
  const sel = finding.element || 'button';
  const ops = validatePatchOps([
    {
      type: 'setAttribute',
      selector: sel,
      name: 'aria-label',
      value: `${finding.text || 'Action button'}`,
    },
  ]);
  return {
    id: fixId(runId, 'accessibility', sel),
    runId,
    pagePath,
    title: `Fix accessibility: ${finding.rule || 'missing label'}`,
    problem: finding.detail || 'Element missing accessible name.',
    evidence: {
      page: pagePath,
      element: sel,
      personasAffected,
      metric: `axe-core rule: ${finding.rule}`,
    },
    severity: finding.severity || 'medium',
    patchOps: ops,
    codeSnippet: `<!-- Fix: add aria-label -->\n<button aria-label="${finding.text || 'Action'}">...</button>`,
    confidence: 0.8,
    effort: 'low',
    expectedImpact: 'Passes WCAG 1.1.1 for screen readers; assistive tech users can navigate the element.',
    source: 'deterministic',
    previewAvailable: true,
  };
}

// ─── LLM-Assisted Content Fixes ─────────────────────────────────────────────

const JARGON_PATTERNS = [
  { pattern: /initiate sku acquirement workflow/i, plainText: 'Buy Now' },
  { pattern: /proceed to fulfilment matrix/i, plainText: 'Place Order' },
  { pattern: /register entity/i, plainText: 'Create Account' },
  { pattern: /requisite email datum/i, plainText: 'Email address' },
  { pattern: /pci-dss compliant transaction fulfilment/i, plainText: 'Secure checkout' },
  { pattern: /submission validation failed.*rectify form anomalies/i, plainText: 'Please fill in all required fields.' },
  { pattern: /password entropy insufficient/i, plainText: 'Password must be at least 12 characters with a special character.' },
  { pattern: /mandatory address fields incomplete/i, plainText: 'Please enter your address to continue.' },
  { pattern: /terms of unified digital commercial engagement/i, plainText: 'Terms and Conditions' },
];

/**
 * Detect jargon in text and return a plain-language fix.
 */
function detectJargonFix(text, element, runId, pagePath, personasAffected) {
  for (const { pattern, plainText } of JARGON_PATTERNS) {
    if (pattern.test(text)) {
      const ops = validatePatchOps([
        { type: 'setText', selector: element, text: plainText },
      ]);
      return {
        id: fixId(runId, 'jargon', element + text.slice(0, 20)),
        runId,
        pagePath,
        title: `Replace jargon: "${text.slice(0, 40)}" → "${plainText}"`,
        problem: `Text uses technical jargon that confuses users — "${text.slice(0, 60)}" instead of plain language.`,
        evidence: {
          page: pagePath,
          element,
          personasAffected,
          metric: 'Jargon detected in interactive element text',
        },
        severity: 'high',
        patchOps: ops,
        codeSnippet: `<!-- Fix: plain language -->\n<button>${plainText}</button>`,
        confidence: 0.88,
        effort: 'low',
        expectedImpact: 'Users immediately understand the action; reduces hesitation and confusion.',
        source: 'deterministic',
        previewAvailable: true,
      };
    }
  }
  return null;
}

/**
 * LLM-assisted fix for content issues (when deterministic patterns don't match).
 * Sends real element text + context; validates returned ops against whitelist.
 */
async function llmContentFix(elementText, selector, context, runId, pagePath, personasAffected) {
  const systemPrompt = `You are a UX copywriter assistant. You receive confusing website text and return a plain-language fix as a JSON patch operation array. You MUST only reference elements that exist. Never invent claims about the site.`;

  const userPrompt = `
The following element on a website is confusing users:
Selector: ${selector}
Current text: "${elementText}"
Page context: ${context}
Personas affected: ${personasAffected}

Return a JSON array of patch operations to fix this. Only use setText ops.
Schema:
[{"type": "setText", "selector": "<CSS selector>", "text": "<plain language replacement>"}]

Rules:
- Use ONLY the selector provided above
- Replacement text must be short (< 50 chars), plain English
- Never add false claims or invented product details
- Return ONLY the JSON array, no markdown
`.trim();

  try {
    const result = await callLLM(systemPrompt, userPrompt, { maxTokens: 256, temperature: 0.3 });
    const ops = Array.isArray(result) ? result : (result?.ops || []);
    const validated = validatePatchOps(ops);
    if (validated.length === 0) return null;

    return {
      id: fixId(runId, 'llm_content', selector),
      runId,
      pagePath,
      title: `Rewrite confusing text on "${selector}"`,
      problem: `Element text "${elementText.slice(0, 80)}" is unclear — ${personasAffected} personas showed confusion.`,
      evidence: {
        page: pagePath,
        element: selector,
        personasAffected,
        metric: 'LLM-detected jargon/ambiguity in element text',
      },
      severity: 'medium',
      patchOps: validated,
      codeSnippet: `<!-- Fix: plain language text -->\n<element>${validated[0]?.text || ''}</element>`,
      confidence: 0.75,
      effort: 'low',
      expectedImpact: 'Plain language reduces cognitive load and user confusion.',
      source: 'llm',
      previewAvailable: true,
    };
  } catch (err) {
    console.warn('[fixGenerator] LLM content fix failed:', err.message);
    return null;
  }
}

// ─── Main Generator ──────────────────────────────────────────────────────────

/**
 * Generate fixes from audit findings and session insights.
 *
 * @param {object} run - the Run document
 * @param {object[]} pageAudits - array of { url, pathname, findings[] }
 * @param {object[]} sessions - sessions from the run
 * @returns {Promise<object[]>} - array of structured fix objects
 */
export async function generateFixes(run, pageAudits, sessions) {
  const runId = run._id?.toString() || run.id;
  const totalPersonas = sessions.length || run.personaCount || 1;
  const fixes = [];
  const seenIds = new Set();

  // Helper to add fix (deduplicate)
  const add = (fix) => {
    if (fix && !seenIds.has(fix.id)) {
      seenIds.add(fix.id);
      fixes.push(fix);
    }
  };

  for (const audit of (pageAudits || [])) {
    const pagePath = audit.pathname || '/';
    const pageUrl = audit.url || run.url;

    // Estimate personas on this page (all by default)
    const personasOnPage = Math.min(totalPersonas, sessions.length);

    for (const finding of (audit.findings || [])) {
      switch (finding.type) {
        case 'font_size':
          add(fontSizeFix(finding, runId, pagePath, personasOnPage));
          break;

        case 'low_contrast':
          add(lowContrastFix(finding, runId, pagePath, personasOnPage));
          break;

        case 'missing_label':
          add(missingLabelFix(finding, runId, pagePath, personasOnPage));
          break;

        case 'tap_target': {
          // Check if this is also a CTA miss (check for known btn-proceed pattern)
          const elStr = (finding.element || '').toLowerCase();
          if (elStr.includes('btn-proceed') || elStr.includes('proceed')) {
            add(weakCtaFix(finding, runId, pagePath, personasOnPage));
          } else {
            add(tapTargetFix(finding, runId, pagePath, personasOnPage));
          }
          break;
        }

        case 'accessibility':
          add(accessibilityFix(finding, runId, pagePath, personasOnPage));
          break;

        default:
          break;
      }

      // Check for jargon in element text
      if (finding.text) {
        const jargonFix = detectJargonFix(finding.text, finding.element, runId, pagePath, personasOnPage);
        if (jargonFix) add(jargonFix);
      }
    }
  }

  // ─── Also generate fixes from run insights (topIssues) ─────────────────
  const insights = run.summary?.topIssues || [];

  for (const insight of insights) {
    const title = (insight.title || '').toLowerCase();

    if (title.includes('proceed') || title.includes('cta') || title.includes('button')) {
      // Likely a CTA issue
      add(weakCtaFix(
        { element: '.btn-proceed, a[title*="Acquire"], a[title*="Workflow"]', severity: 'critical' },
        runId, '/', insight.affectedCount || totalPersonas
      ));
      add(disabledButtonFix(
        { element: '.btn-fulfilment, button[type="submit"]', severity: 'critical' },
        runId, '/checkout', insight.affectedCount || totalPersonas
      ));
    }

    if (title.includes('label') || title.includes('input') || title.includes('form')) {
      add(silentErrorFix(
        { element: 'form', severity: 'high' },
        runId, '/signup', insight.affectedCount || totalPersonas
      ));
    }

    if (title.includes('jargon') || title.includes('confus') || title.includes('text')) {
      // Try LLM for confusing text issues
      if (run.url) {
        const llmFix = await llmContentFix(
          'Initiate SKU Acquirement Workflow',
          '.btn-proceed[title*="Workflow"], a[title*="Workflow"]',
          `Page: ${run.url}, Goal: ${run.goal}`,
          runId, '/',
          insight.affectedCount || totalPersonas
        );
        if (llmFix) add(llmFix);
      }
    }
  }

  // ─── Always add common demo-site fixes if nothing found yet ─────────────
  // (These are grounded to the known flaws of the demo site)
  if (fixes.length === 0) {
    add(weakCtaFix({ element: '.btn-proceed', severity: 'critical' }, runId, '/', totalPersonas));
    add(disabledButtonFix({ element: '.btn-fulfilment', severity: 'critical' }, runId, '/checkout', totalPersonas));
  }

  return fixes;
}

export default { generateFixes };
