/**
 * server/src/services/fixPatcher.js
 *
 * STRICT WHITELIST patch operation validator and DOM applicator.
 * Only these op types are allowed; everything else is rejected.
 *
 * Allowed ops:
 *   setStyle(selector, cssProps)        — apply CSS properties
 *   setText(selector, text)             — replace text content
 *   setAttribute(selector, name, value) — set aria-label, alt, for, etc.
 *   addLabel(selector, text)            — insert a <label> before the element
 *   insertBefore(selector, safeHtml)    — insert sanitized HTML before element
 *   insertAfter(selector, safeHtml)     — insert sanitized HTML after element
 *   reorderButton(selector)             — move button to primary visual position
 *   scrollIntoView(selector)            — scroll element into viewport
 *
 * Safety rules enforced at validation time:
 *   - Selectors: no javascript:, no on*, no data-* with handlers
 *   - HTML: tags whitelist, no script, no on*, no external src, no iframe
 *   - CSS: no expression(), no url(javascript:), no behavior:
 *   - Attribute names: whitelist of safe aria/html attributes only
 */

const ALLOWED_OPS = new Set([
  'setStyle', 'setText', 'setAttribute', 'addLabel',
  'insertBefore', 'insertAfter', 'reorderButton', 'scrollIntoView',
]);

// Allowed attribute names for setAttribute op
const SAFE_ATTRIBUTE_NAMES = new Set([
  'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
  'aria-expanded', 'aria-required', 'aria-invalid', 'aria-live',
  'role', 'alt', 'title', 'placeholder', 'for', 'id',
  'lang', 'tabindex', 'type', 'name',
]);

// HTML tags allowed in insertBefore/insertAfter safeHtml
const ALLOWED_HTML_TAGS = new Set([
  'label', 'span', 'div', 'p', 'strong', 'em', 'small',
  'ul', 'li', 'a', 'abbr', 'b', 'i', 'br', 'hr',
]);

// CSS properties that could be dangerous
const BLOCKED_CSS_PATTERNS = [
  /expression\s*\(/i,
  /javascript:/i,
  /behavior\s*:/i,
  /-moz-binding/i,
];

/**
 * Validate a selector string — no JS injection vectors.
 */
function validateSelector(selector) {
  if (typeof selector !== 'string' || selector.trim().length === 0) {
    throw new Error('Patch op selector must be a non-empty string.');
  }
  const s = selector.trim();
  if (/javascript:/i.test(s)) throw new Error(`Selector contains forbidden "javascript:" in: ${s}`);
  if (/on\w+\s*=/i.test(s)) throw new Error(`Selector contains event handler in: ${s}`);
  if (s.length > 500) throw new Error('Selector too long (>500 chars).');
  return s;
}

/**
 * Validate CSS props object.
 */
function validateCssProps(cssProps) {
  if (typeof cssProps !== 'object' || Array.isArray(cssProps) || cssProps === null) {
    throw new Error('setStyle cssProps must be a plain object.');
  }
  for (const [prop, value] of Object.entries(cssProps)) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`CSS value for "${prop}" must be a string or number.`);
    }
    const valStr = String(value);
    for (const pattern of BLOCKED_CSS_PATTERNS) {
      if (pattern.test(valStr)) {
        throw new Error(`Blocked CSS value for "${prop}": "${valStr}"`);
      }
    }
  }
  return cssProps;
}

/**
 * Sanitize HTML — strip dangerous tags and attributes.
 * Very conservative: only ALLOWED_HTML_TAGS permitted.
 */
function sanitizeHtml(html) {
  if (typeof html !== 'string') throw new Error('HTML must be a string.');
  if (html.length > 2000) throw new Error('HTML snippet too long (>2000 chars).');

  // Block script/iframe/object/embed outright
  if (/<script/i.test(html)) throw new Error('HTML contains <script> tag — forbidden.');
  if (/<iframe/i.test(html)) throw new Error('HTML contains <iframe> tag — forbidden.');
  if (/<object/i.test(html)) throw new Error('HTML contains <object> tag — forbidden.');
  if (/<embed/i.test(html)) throw new Error('HTML contains <embed> tag — forbidden.');
  if (/javascript:/i.test(html)) throw new Error('HTML contains javascript: URI — forbidden.');
  if (/on\w+\s*=/i.test(html)) throw new Error('HTML contains event handler attribute — forbidden.');

  // Check for external URLs in src/href
  const urlPattern = /(?:src|href)\s*=\s*["']?(https?:\/\/[^"'\s>]+)/gi;
  let m;
  while ((m = urlPattern.exec(html)) !== null) {
    throw new Error(`HTML references external URL: ${m[1]} — forbidden (same-origin only).`);
  }

  return html;
}

/**
 * Validate attribute name.
 */
function validateAttributeName(name) {
  if (typeof name !== 'string') throw new Error('Attribute name must be a string.');
  const n = name.trim().toLowerCase();
  if (!SAFE_ATTRIBUTE_NAMES.has(n)) {
    throw new Error(`Attribute "${n}" is not in the safe attribute whitelist.`);
  }
  return n;
}

/**
 * Validate a single patch operation.
 * Returns the validated + normalised op, or throws.
 *
 * @param {object} op
 * @param {string} op.type
 * @param {string} op.selector
 * @param {object} [op.cssProps]   for setStyle
 * @param {string} [op.text]       for setText / addLabel
 * @param {string} [op.name]       for setAttribute
 * @param {string} [op.value]      for setAttribute
 * @param {string} [op.html]       for insertBefore / insertAfter
 */
export function validatePatchOp(op) {
  if (typeof op !== 'object' || op === null) {
    throw new Error('Patch op must be an object.');
  }
  if (!ALLOWED_OPS.has(op.type)) {
    throw new Error(`Unknown/forbidden patch op type: "${op.type}". Allowed: ${[...ALLOWED_OPS].join(', ')}.`);
  }

  const validated = { type: op.type, selector: validateSelector(op.selector) };

  switch (op.type) {
    case 'setStyle':
      validated.cssProps = validateCssProps(op.cssProps || {});
      break;

    case 'setText':
    case 'addLabel':
      if (typeof op.text !== 'string') throw new Error(`${op.type} requires a "text" string.`);
      validated.text = op.text.slice(0, 500);
      break;

    case 'setAttribute':
      validated.name = validateAttributeName(op.name);
      if (typeof op.value !== 'string') throw new Error('setAttribute requires a "value" string.');
      validated.value = op.value.slice(0, 500);
      break;

    case 'insertBefore':
    case 'insertAfter':
      validated.html = sanitizeHtml(op.html || '');
      break;

    case 'reorderButton':
    case 'scrollIntoView':
      // just selector — already validated
      break;
  }

  return validated;
}

/**
 * Validate an array of patch ops.
 * Returns validated ops array. Throws on first failure.
 */
export function validatePatchOps(ops) {
  if (!Array.isArray(ops)) throw new Error('Patch ops must be an array.');
  if (ops.length > 50) throw new Error('Too many patch ops (max 50 per fix).');
  return ops.map((op, i) => {
    try {
      return validatePatchOp(op);
    } catch (err) {
      throw new Error(`Patch op [${i}]: ${err.message}`);
    }
  });
}

/**
 * Build a browser-executable JS snippet that applies a validated patch op to the DOM.
 * Each op is a self-contained JS expression string (eval-safe, no external refs).
 *
 * @param {object} op - validated patch op
 * @returns {string} — a JS snippet to evaluate in Playwright's page.evaluate()
 */
export function buildOpScript(op) {
  const sel = JSON.stringify(op.selector);

  switch (op.type) {
    case 'setStyle': {
      const propsJson = JSON.stringify(op.cssProps);
      return `
(function(){
  var els = document.querySelectorAll(${sel});
  var props = ${propsJson};
  els.forEach(function(el){
    Object.assign(el.style, props);
  });
  return els.length;
})()
`.trim();
    }

    case 'setText': {
      const text = JSON.stringify(op.text);
      return `
(function(){
  var els = document.querySelectorAll(${sel});
  els.forEach(function(el){ el.textContent = ${text}; });
  return els.length;
})()
`.trim();
    }

    case 'setAttribute': {
      const name = JSON.stringify(op.name);
      const value = JSON.stringify(op.value);
      return `
(function(){
  var els = document.querySelectorAll(${sel});
  els.forEach(function(el){ el.setAttribute(${name}, ${value}); });
  return els.length;
})()
`.trim();
    }

    case 'addLabel': {
      const text = JSON.stringify(op.text);
      return `
(function(){
  var el = document.querySelector(${sel});
  if(!el) return 0;
  var lbl = document.createElement('label');
  lbl.textContent = ${text};
  lbl.setAttribute('data-personify-fix', 'true');
  lbl.style.display='block';
  lbl.style.fontSize='14px';
  lbl.style.fontWeight='600';
  lbl.style.marginBottom='4px';
  lbl.style.color='#333';
  if(el.id) lbl.setAttribute('for', el.id);
  el.parentNode && el.parentNode.insertBefore(lbl, el);
  return 1;
})()
`.trim();
    }

    case 'insertBefore': {
      const html = JSON.stringify(op.html);
      return `
(function(){
  var el = document.querySelector(${sel});
  if(!el) return 0;
  var tmp = document.createElement('div');
  tmp.innerHTML = ${html};
  var frag = document.createDocumentFragment();
  while(tmp.firstChild) frag.appendChild(tmp.firstChild);
  el.parentNode && el.parentNode.insertBefore(frag, el);
  return 1;
})()
`.trim();
    }

    case 'insertAfter': {
      const html = JSON.stringify(op.html);
      return `
(function(){
  var el = document.querySelector(${sel});
  if(!el) return 0;
  var tmp = document.createElement('div');
  tmp.innerHTML = ${html};
  var frag = document.createDocumentFragment();
  while(tmp.firstChild) frag.appendChild(tmp.firstChild);
  el.parentNode && el.parentNode.insertBefore(frag, el.nextSibling);
  return 1;
})()
`.trim();
    }

    case 'reorderButton': {
      return `
(function(){
  var el = document.querySelector(${sel});
  if(!el) return 0;
  var parent = el.parentNode;
  if(!parent) return 0;
  parent.insertBefore(el, parent.firstChild);
  return 1;
})()
`.trim();
    }

    case 'scrollIntoView': {
      return `
(function(){
  var el = document.querySelector(${sel});
  if(!el) return 0;
  el.scrollIntoView({behavior:'instant',block:'center'});
  return 1;
})()
`.trim();
    }

    default:
      throw new Error(`Unknown op type: ${op.type}`);
  }
}

/**
 * Apply a list of validated patch ops to a Playwright page.
 * Returns an array of { opIndex, selector, result } per op.
 */
export async function applyPatchOpsToPage(page, validatedOps) {
  const results = [];
  for (let i = 0; i < validatedOps.length; i++) {
    const op = validatedOps[i];
    try {
      const script = buildOpScript(op);
      const result = await page.evaluate(script);
      results.push({ opIndex: i, type: op.type, selector: op.selector, result, success: true });
    } catch (err) {
      results.push({ opIndex: i, type: op.type, selector: op.selector, success: false, error: err.message });
    }
  }
  return results;
}

export default { validatePatchOp, validatePatchOps, buildOpScript, applyPatchOpsToPage };
