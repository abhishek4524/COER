/**
 * Route test script — run with: node scripts/testRoutes.js
 * Tests all API routes against a running server (PORT 5000).
 * Reports pass/fail for each.
 */
import 'dotenv/config';

const BASE = `http://localhost:${process.env.PORT || 5000}`;
let pass = 0;
let fail = 0;
let createdRunId = null;
let createdPersonaId = null;

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function test(label, fn) {
  try {
    const result = await fn();
    if (result.ok) {
      console.log(`${GREEN}✓${RESET} ${label}`);
      pass++;
    } else {
      console.log(`${RED}✗${RESET} ${label} — ${result.reason}`);
      fail++;
    }
  } catch (err) {
    console.log(`${RED}✗${RESET} ${label} — ${err.message}`);
    fail++;
  }
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json();
  return { res, body };
}

async function post(path, data) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  return { res, body };
}

console.log(`\n${YELLOW}=== Personify API Route Tests ===${RESET}`);
console.log(`Target: ${BASE}\n`);

// ─── Health ───────────────────────────────────────────────────────────────────
await test('GET /health', async () => {
  const { res, body } = await get('/health');
  return res.ok && body.status === 'ok'
    ? { ok: true }
    : { ok: false, reason: `status=${res.status} body=${JSON.stringify(body)}` };
});

// ─── Personas ─────────────────────────────────────────────────────────────────
await test('GET /api/personas (empty or seeded)', async () => {
  const { res, body } = await get('/api/personas');
  return res.ok && Array.isArray(body.data)
    ? { ok: true }
    : { ok: false, reason: JSON.stringify(body) };
});

await test('POST /api/personas (create test persona)', async () => {
  const { res, body } = await post('/api/personas', {
    name: 'Test User Route',
    age: 25,
    traits: { patience: 60, techSavviness: 70, device: 'MacBook Air', language: 'en', accessibility: 'none' },
    backstory: 'A test persona created by the route test script.',
    systemPrompt: 'You are a test persona.',
    isCustom: true,
  });
  if (res.ok && body.data?._id) {
    createdPersonaId = body.data._id;
    return { ok: true };
  }
  return { ok: false, reason: JSON.stringify(body) };
});

await test('GET /api/personas/:id', async () => {
  if (!createdPersonaId) return { ok: false, reason: 'No persona id from previous test' };
  const { res, body } = await get(`/api/personas/${createdPersonaId}`);
  return res.ok && body.data?.name === 'Test User Route'
    ? { ok: true }
    : { ok: false, reason: JSON.stringify(body) };
});

// ─── Runs ─────────────────────────────────────────────────────────────────────
await test('POST /api/runs (create run)', async () => {
  const { res, body } = await post('/api/runs', {
    url: 'http://localhost:3000',
    goal: 'Complete checkout',
    personaCount: 5,
    device: 'desktop',
  });
  if (res.ok && body.data?._id) {
    createdRunId = body.data._id;
    return { ok: true };
  }
  return { ok: false, reason: JSON.stringify(body) };
});

await test('GET /api/runs (list runs)', async () => {
  const { res, body } = await get('/api/runs');
  return res.ok && Array.isArray(body.data)
    ? { ok: true }
    : { ok: false, reason: JSON.stringify(body) };
});

await test('GET /api/runs/:id', async () => {
  if (!createdRunId) return { ok: false, reason: 'No run id from previous test' };
  const { res, body } = await get(`/api/runs/${createdRunId}`);
  return res.ok && body.data?._id
    ? { ok: true }
    : { ok: false, reason: JSON.stringify(body) };
});

await test('GET /api/runs/:id/sessions (empty)', async () => {
  if (!createdRunId) return { ok: false, reason: 'No run id' };
  const { res, body } = await get(`/api/runs/${createdRunId}/sessions`);
  return res.ok && Array.isArray(body.data)
    ? { ok: true }
    : { ok: false, reason: JSON.stringify(body) };
});

await test('POST /api/runs/:id/verify-ownership (localhost bypass in dev)', async () => {
  if (!createdRunId) return { ok: false, reason: 'No run id' };
  const { res, body } = await post(`/api/runs/${createdRunId}/verify-ownership`, {});
  return res.ok && body.verified === true && body.method === 'localhost_bypass'
    ? { ok: true }
    : { ok: false, reason: JSON.stringify(body) };
});

// ─── 404 test ─────────────────────────────────────────────────────────────────
await test('GET /api/nonexistent (404 handler)', async () => {
  const { res } = await get('/api/nonexistent');
  return res.status === 404 ? { ok: true } : { ok: false, reason: `Got ${res.status}` };
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${YELLOW}Results: ${GREEN}${pass} passed${RESET}, ${fail > 0 ? RED : ''}${fail} failed${RESET}\n`);
process.exit(fail > 0 ? 1 : 0);
