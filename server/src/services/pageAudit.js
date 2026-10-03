/**
 * server/src/services/pageAudit.js
 *
 * Automated page audit on each visited page:
 * - axe-core accessibility engine
 * - Font size < 12px detection
 * - Missing form labels detection
 * - Tap target < 44px detection (WCAG touch target size)
 * - Low contrast detection
 * - Page load time measurement
 */

import axe from 'axe-core';

export async function runPageAudit(page, url, navDurationMs = 0) {
  const urlObj = (() => {
    try { return new URL(url); } catch { return { pathname: url }; }
  })();

  const auditResult = {
    url,
    pathname: urlObj.pathname,
    timestamp: new Date(),
    navDurationMs: Math.round(navDurationMs),
    findings: [],
  };

  try {
    // 1. Run axe-core accessibility audit
    try {
      await page.evaluate(axe.source);
      const axeData = await page.evaluate(async () => {
        try {
          // @ts-ignore
          const res = await window.axe.run(document, {
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa', 'best-practice'],
            },
          });
          return (res.violations || []).slice(0, 10).map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: (v.nodes || []).slice(0, 3).map((n) => ({
              target: (n.target || []).join(' '),
              html: (n.html || '').slice(0, 100),
              failureSummary: n.failureSummary,
            })),
          }));
        } catch {
          return [];
        }
      });

      for (const v of axeData) {
        auditResult.findings.push({
          type: 'accessibility',
          severity: v.impact === 'critical' ? 'critical' : v.impact === 'serious' ? 'high' : 'medium',
          rule: v.id,
          element: v.nodes[0]?.target || 'element',
          text: v.nodes[0]?.html || '',
          detail: v.help + (v.nodes[0]?.failureSummary ? `: ${v.nodes[0].failureSummary.slice(0, 120)}` : ''),
        });
      }
    } catch (axeErr) {
      console.warn('[pageAudit] axe-core execution warning:', axeErr.message);
    }

    // 2. Custom DOM Heuristic Audits: font size, labels, tap target, contrast
    const domFindings = await page.evaluate(() => {
      const results = [];

      // Check all elements with text for small font (< 12px)
      const textTags = ['p', 'span', 'a', 'button', 'label', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'];
      const seenElements = new Set();

      document.querySelectorAll(textTags.join(',')).forEach((el) => {
        const text = el.textContent?.trim();
        if (!text || text.length === 0 || el.children.length > 2) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

        const fontSize = parseFloat(style.fontSize) || 16;
        if (fontSize < 12 && !seenElements.has(el)) {
          seenElements.add(el);
          results.push({
            type: 'font_size',
            severity: fontSize <= 9 ? 'critical' : 'high',
            element: el.tagName.toLowerCase() + (el.className ? `.${el.className.trim().split(/\s+/)[0]}` : ''),
            text: text.slice(0, 80),
            detail: `Font size is ${Math.round(fontSize)}px (minimum recommended readable size is 12-14px).`,
            fontSize: Math.round(fontSize),
          });
        }
      });

      // Check form inputs for missing visible labels
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select').forEach((input) => {
        let hasLabel = false;
        if (input.id) {
          const lbl = document.querySelector(`label[for="${input.id}"]`);
          if (lbl && lbl.textContent?.trim()) hasLabel = true;
        }
        if (!hasLabel && input.closest('label')) hasLabel = true;
        if (!hasLabel && input.getAttribute('aria-label')) hasLabel = true;
        if (!hasLabel && input.getAttribute('aria-labelledby')) hasLabel = true;

        if (!hasLabel) {
          results.push({
            type: 'missing_label',
            severity: 'high',
            element: input.tagName.toLowerCase() + (input.name ? `[name="${input.name}"]` : input.id ? `#${input.id}` : ''),
            text: input.getAttribute('placeholder') || input.name || input.id || 'unlabeled input',
            detail: `Form field has no visible <label> or aria-label (only placeholder: "${input.getAttribute('placeholder') || 'none'}").`,
          });
        }
      });

      // Check clickable buttons & links for tap target < 44px
      document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;

        if (rect.width < 44 || rect.height < 44) {
          const text = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
          if (text.length > 0) {
            results.push({
              type: 'tap_target',
              severity: (rect.width < 30 || rect.height < 30) ? 'high' : 'medium',
              element: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
              text: text.slice(0, 60),
              detail: `Tap target size is ${Math.round(rect.width)}x${Math.round(rect.height)}px (less than the recommended 44x44px minimum).`,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            });
          }
        }
      });

      // Check for low contrast (e.g. very light text on light background)
      document.querySelectorAll('a, button, p, span').forEach((el) => {
        const text = el.textContent?.trim();
        if (!text || text.length === 0 || el.children.length > 0) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;

        // Simple RGB check for light color on light background
        const color = style.color; // rgb(r, g, b)
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
          // Luminance approximation
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum > 190 && lum < 240) { // pale/light text
            results.push({
              type: 'low_contrast',
              severity: 'high',
              element: el.tagName.toLowerCase(),
              text: text.slice(0, 60),
              detail: `Low text contrast detected (${color}), which may be difficult for users to read.`,
            });
          }
        }
      });

      return results.slice(0, 15);
    }).catch(() => []);

    auditResult.findings.push(...domFindings);

    // Deduplicate findings by element + type
    const unique = [];
    const keys = new Set();
    for (const f of auditResult.findings) {
      const key = `${f.type}|${f.element}|${f.text?.slice(0, 20)}`;
      if (!keys.has(key)) {
        keys.add(key);
        unique.push(f);
      }
    }
    auditResult.findings = unique;

  } catch (err) {
    console.warn(`[pageAudit] Audit error for ${url}:`, err.message);
  }

  return auditResult;
}

export default runPageAudit;
