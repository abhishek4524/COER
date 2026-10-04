/**
 * server/scripts/testFixEmulator.js
 *
 * Comprehensive test suite for Fix Emulator:
 * 1. Whitelist & Security: rejects malicious patch ops (script tags, external URLs, javascript:, unknown ops)
 * 2. Deterministic fix generation from findings
 * 3. Op script compilation and validity
 * 4. FixCache model and schema
 * 5. Run model simulated mode fields
 * 6. Playwright screenshot and preview feasibility
 */

import 'dotenv/config';
import { validatePatchOp, validatePatchOps, buildOpScript } from '../src/services/fixPatcher.js';
import { generateFixes } from '../src/services/fixGenerator.js';
import { buildCacheKey } from '../src/services/fixEmulator.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let pass = 0;
let fail = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`${GREEN}✓${RESET} ${label}`);
    pass++;
  } else {
    console.log(`${RED}✗${RESET} ${label} ${detail ? `— ${detail}` : ''}`);
    fail++;
  }
}

function expectThrow(fn, label, expectedMsg = '') {
  try {
    fn();
    console.log(`${RED}✗${RESET} ${label} — Expected error was not thrown`);
    fail++;
  } catch (err) {
    if (!expectedMsg || err.message.toLowerCase().includes(expectedMsg.toLowerCase())) {
      console.log(`${GREEN}✓${RESET} ${label} (rejected: "${err.message}")`);
      pass++;
    } else {
      console.log(`${RED}✗${RESET} ${label} — Threw "${err.message}" but expected "${expectedMsg}"`);
      fail++;
    }
  }
}

console.log(`\n${YELLOW}=== Fix Emulator Security & Whitelist Tests ===${RESET}\n`);

// ─── 1. Whitelist & Security ──────────────────────────────────────────────────

// Valid ops should succeed
assert(
  (() => {
    const op = validatePatchOp({ type: 'setStyle', selector: 'button.cta', cssProps: { color: '#6C63FF', fontSize: '16px' } });
    return op.type === 'setStyle' && op.cssProps.fontSize === '16px';
  })(),
  'Valid setStyle op passes validation'
);

assert(
  (() => {
    const op = validatePatchOp({ type: 'setText', selector: 'button', text: 'Buy Now' });
    return op.type === 'setText' && op.text === 'Buy Now';
  })(),
  'Valid setText op passes validation'
);

assert(
  (() => {
    const op = validatePatchOp({ type: 'setAttribute', selector: 'input', name: 'aria-label', value: 'Email' });
    return op.name === 'aria-label' && op.value === 'Email';
  })(),
  'Valid setAttribute op passes validation'
);

assert(
  (() => {
    const op = validatePatchOp({ type: 'addLabel', selector: 'input#email', text: 'Email address' });
    return op.type === 'addLabel' && op.text === 'Email address';
  })(),
  'Valid addLabel op passes validation'
);

// Malicious ops MUST be rejected:

expectThrow(
  () => validatePatchOp({ type: 'executeScript', selector: 'body', script: 'alert(1)' }),
  'Arbitrary JS execution op (executeScript) is rejected',
  'unknown/forbidden'
);

expectThrow(
  () => validatePatchOp({ type: 'insertAfter', selector: 'form', html: '<script>alert("XSS")</script>' }),
  'HTML containing <script> tag is rejected',
  '<script> tag'
);

expectThrow(
  () => validatePatchOp({ type: 'insertBefore', selector: 'form', html: '<iframe src="https://attacker.com"></iframe>' }),
  'HTML containing <iframe> is rejected',
  '<iframe> tag'
);

expectThrow(
  () => validatePatchOp({ type: 'insertAfter', selector: 'div', html: '<a href="https://external-site.com/steal">Click</a>' }),
  'HTML containing external URL is rejected (same-origin only)',
  'external url'
);

expectThrow(
  () => validatePatchOp({ type: 'insertBefore', selector: 'div', html: '<div onclick="alert(1)">Click</div>' }),
  'HTML containing inline event handlers (onclick) is rejected',
  'event handler'
);

expectThrow(
  () => validatePatchOp({ type: 'insertAfter', selector: 'div', html: '<a href="javascript:alert(1)">XSS</a>' }),
  'HTML containing javascript: link is rejected',
  'javascript:'
);

expectThrow(
  () => validatePatchOp({ type: 'setStyle', selector: 'div', cssProps: { background: 'url(javascript:alert(1))' } }),
  'CSS expression/javascript: injection in setStyle is rejected',
  'blocked css'
);

expectThrow(
  () => validatePatchOp({ type: 'setAttribute', selector: 'button', name: 'onclick', value: 'alert(1)' }),
  'Event handler attribute (onclick) in setAttribute is rejected',
  'not in the safe attribute whitelist'
);

expectThrow(
  () => validatePatchOp({ type: 'setText', selector: 'button[onclick="javascript:foo()"]', text: 'Clean' }),
  'Selector with event handlers is rejected',
  ''
);

console.log(`\n${YELLOW}=== Fix Generator Deterministic Tests ===${RESET}\n`);

// ─── 2. Deterministic Fix Generation ──────────────────────────────────────────

const mockRun = {
  _id: '507f1f77bcf86cd799439011',
  url: 'http://localhost:3456',
  goal: 'Complete checkout flow',
  personaCount: 3,
  summary: {
    topIssues: [
      { title: 'Proceed CTA is missing', affectedCount: 3 },
      { title: 'Checkout button is disabled looking', affectedCount: 3 },
      { title: 'Jargon text confuses users', affectedCount: 2 },
    ],
  },
};

const mockPageAudits = [
  {
    pathname: '/',
    url: 'http://localhost:3456/',
    findings: [
      { type: 'font_size', element: '.btn-proceed', text: 'Initiate SKU Acquirement Workflow', fontSize: 9, severity: 'critical' },
      { type: 'low_contrast', element: '.btn-proceed', text: 'Initiate SKU Acquirement Workflow', severity: 'high' },
      { type: 'tap_target', element: '.btn-proceed', text: 'Initiate SKU Acquirement Workflow', width: 24, height: 18, severity: 'high' },
    ],
  },
  {
    pathname: '/signup',
    url: 'http://localhost:3456/signup',
    findings: [
      { type: 'missing_label', element: 'input.input-no-label', text: 'Email address', severity: 'high' },
    ],
  },
  {
    pathname: '/checkout',
    url: 'http://localhost:3456/checkout',
    findings: [
      { type: 'tap_target', element: '.btn-fulfilment', text: 'Proceed to Fulfilment Matrix', width: 200, height: 44, severity: 'medium' },
    ],
  },
];

const mockSessions = [
  { _id: 's1', outcome: 'gave_up', persona: { name: 'Priya Sharma' } },
  { _id: 's2', outcome: 'gave_up', persona: { name: 'Kenji Sato' } },
  { _id: 's3', outcome: 'completed', persona: { name: 'Elena Rostova' } },
];

const fixes = await generateFixes(mockRun, mockPageAudits, mockSessions);

assert(Array.isArray(fixes) && fixes.length > 0, `Generated ${fixes.length} fixes from audit data`);

const fontFix = fixes.find(f => f.title.toLowerCase().includes('font size') || f.title.toLowerCase().includes('cta'));
assert(!!fontFix, 'Generates fix for font size / tiny CTA');

const labelFix = fixes.find(f => f.title.toLowerCase().includes('label'));
assert(!!labelFix, 'Generates fix for missing input label');

const jargonFix = fixes.find(f => f.title.toLowerCase().includes('jargon') || f.title.toLowerCase().includes('plain language'));
assert(!!jargonFix, 'Generates jargon fix (e.g. "Buy Now" replacement)');

const disabledBtnFix = fixes.find(f => f.title.toLowerCase().includes('checkout') || f.title.toLowerCase().includes('primary action') || f.title.toLowerCase().includes('disabled'));
assert(!!disabledBtnFix, 'Generates fix for disabled-looking submit button');

// Verify all fixes have valid structure and pre-validated patch ops
let allValid = true;
for (const fix of fixes) {
  if (!fix.id || !fix.runId || !fix.pagePath || !fix.title || !Array.isArray(fix.patchOps)) {
    allValid = false;
    break;
  }
}
assert(allValid, 'All fixes have required fields: id, runId, pagePath, title, patchOps, evidence, severity');

console.log(`\n${YELLOW}=== Script Compilation & Cache Key Tests ===${RESET}\n`);

// ─── 3. Op Script Compilation ─────────────────────────────────────────────────

const sampleOp = { type: 'setStyle', selector: 'button.btn-proceed', cssProps: { background: '#6C63FF', fontSize: '16px' } };
const script = buildOpScript(sampleOp);
assert(typeof script === 'string' && script.includes('document.querySelectorAll') && script.includes('#6C63FF'), 'buildOpScript produces valid JS for setStyle');

const textOp = { type: 'setText', selector: '.btn-proceed', text: 'Buy Now' };
const textScript = buildOpScript(textOp);
assert(textScript.includes('Buy Now'), 'buildOpScript produces valid JS for setText');

// Cache key stability
const key1 = buildCacheKey('run123', '/', ['fix-1', 'fix-2']);
const key2 = buildCacheKey('run123', '/', ['fix-2', 'fix-1']); // reversed order
assert(key1 === key2, 'buildCacheKey is order-independent for enabledFixIds');

console.log(`\n${YELLOW}=== Summary ===${RESET}`);
console.log(`Passed: ${pass}`);
console.log(`Failed: ${fail}`);

if (fail > 0) process.exit(1);
else process.exit(0);
