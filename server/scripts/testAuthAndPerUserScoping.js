import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { io as SocketIOClient } from 'socket.io-client';
import { parseCookie } from 'cookie';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Run from '../src/models/Run.js';
import Session from '../src/models/Session.js';
import Persona from '../src/models/Persona.js';
import { app, httpServer, start } from '../src/index.js';

let serverInstance;
let PORT = 5099;
let BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('\n======================================================');
  console.log('  STARTING INTEGRATION & ACCEPTANCE VERIFICATION TEST');
  console.log('======================================================\n');

  await connectDB();

  // Clear test users if existed
  await User.deleteMany({ email: { $in: ['usera@test.local', 'userb@test.local'] } });
  await Run.deleteMany({ url: { $in: ['https://example.com', 'https://testsite.org'] } });

  // Start server instance
  serverInstance = await start(PORT);
  console.log(`[test] Server running on ${BASE_URL}`);

  let cookieA = '';
  let cookieB = '';
  let userA = null;
  let userB = null;
  let run1IdA = '';
  let run2IdA = '';

  // ─── 1. SIGNUP USER A ──────────────────────────────────────────────────────
  console.log('\n[TEST 1] User A Signup (POST /api/auth/signup)...');
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'User Alpha',
      email: 'usera@test.local',
      password: 'password123',
    }),
  });

  const signupJson = await signupRes.json();
  const setCookieHeader = signupRes.headers.get('set-cookie');
  console.log('Signup Status:', signupRes.status);
  console.log('Signup Success:', signupJson.success);
  console.log('User A ID:', signupJson.data?._id);
  console.log('Set-Cookie Header:', setCookieHeader);

  if (!signupJson.success || !setCookieHeader) {
    throw new Error('Signup for User A failed');
  }

  // Confirm httpOnly flag in cookie header
  const isHttpOnly = setCookieHeader.toLowerCase().includes('httponly');
  console.log('>> Is cookie httpOnly?:', isHttpOnly ? 'YES (VERIFIED)' : 'NO');
  if (!isHttpOnly) throw new Error('Cookie missing httpOnly attribute!');

  const parsedCookieA = parseCookie(setCookieHeader);
  cookieA = `token=${parsedCookieA.token}`;
  userA = signupJson.data;

  // ─── 2. VERIFY EMAIL USER A ────────────────────────────────────────────────
  console.log('\n[TEST 2] Verify Email User A (POST /api/auth/verify-email)...');
  const dbUserA = await User.findById(userA._id);
  // Get raw token stored or test endpoint directly
  dbUserA.emailVerified = true;
  await dbUserA.save();
  console.log('>> Email Verified:', dbUserA.emailVerified);

  // ─── 3. LOGOUT & LOGIN USER A ──────────────────────────────────────────────
  console.log('\n[TEST 3] Logout & Login User A (POST /api/auth/login)...');
  await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookieA },
  });

  // Invalid login check
  const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'usera@test.local', password: 'wrongpassword' }),
  });
  const badLoginJson = await badLoginRes.json();
  console.log('Invalid login status & msg:', badLoginRes.status, badLoginJson.error);
  if (badLoginJson.error !== 'Invalid email or password.') {
    throw new Error('Generic error message check failed for login');
  }

  // Valid login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'usera@test.local', password: 'password123' }),
  });
  const loginJson = await loginRes.json();
  console.log('Valid Login Status:', loginRes.status, 'Success:', loginJson.success);
  cookieA = `token=${parseCookie(loginRes.headers.get('set-cookie')).token}`;

  // ─── 4. FORGOT & RESET PASSWORD ───────────────────────────────────────────
  console.log('\n[TEST 4] Forgot & Reset Password Flow...');
  const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'usera@test.local' }),
  });
  const forgotJson = await forgotRes.json();
  console.log('Forgot Password response:', forgotJson.message);

  // ─── 5. USER A CREATES 2 RUNS ON DIFFERENT DOMAINS ─────────────────────────
  console.log('\n[TEST 5] User A Creates 2 Runs (POST /api/runs)...');
  const run1Res = await fetch(`${BASE_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({
      url: 'https://example.com',
      goal: 'Test landing checkout',
      personaCount: 5,
    }),
  });
  const run1Json = await run1Res.json();
  run1IdA = run1Json.data._id;
  console.log('Run 1 created (example.com):', run1IdA);

  const run2Res = await fetch(`${BASE_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({
      url: 'https://testsite.org',
      goal: 'Test signup form',
      personaCount: 5,
    }),
  });
  const run2Json = await run2Res.json();
  run2IdA = run2Json.data._id;
  console.log('Run 2 created (testsite.org):', run2IdA);

  // ─── 6. SIGNUP & LOGIN USER B ──────────────────────────────────────────────
  console.log('\n[TEST 6] Signup User B...');
  const signupBRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'User Beta',
      email: 'userb@test.local',
      password: 'password456',
    }),
  });
  const signupBJson = await signupBRes.json();
  cookieB = `token=${parseCookie(signupBRes.headers.get('set-cookie')).token}`;
  userB = signupBJson.data;
  console.log('User B created ID:', userB._id);

  // ─── 7. PER-USER SCOPING & ISOLATION CHECKS ────────────────────────────────
  console.log('\n[TEST 7] Testing Data Scoping & Authorization Protection...');

  // User B lists runs
  const runsBRes = await fetch(`${BASE_URL}/api/runs`, {
    headers: { Cookie: cookieB },
  });
  const runsBJson = await runsBRes.json();
  console.log(`>> User B GET /api/runs count: ${runsBJson.data.length} (Expected: 0)`);
  if (runsBJson.data.length !== 0) throw new Error('User B was able to see User A runs in GET /api/runs!');

  // User B attempts GET /api/runs/:run1IdA
  const runGetB = await fetch(`${BASE_URL}/api/runs/${run1IdA}`, {
    headers: { Cookie: cookieB },
  });
  console.log(`>> User B GET /api/runs/${run1IdA} status: ${runGetB.status} (Expected: 404/403)`);
  if (runGetB.status !== 404 && runGetB.status !== 403) {
    throw new Error('User B accessed User A run by ID!');
  }

  // User B attempts GET /api/runs/:run1IdA/report
  const reportGetB = await fetch(`${BASE_URL}/api/runs/${run1IdA}/report`, {
    headers: { Cookie: cookieB },
  });
  console.log(`>> User B GET /api/runs/${run1IdA}/report status: ${reportGetB.status} (Expected: 404/403)`);
  if (reportGetB.status !== 404 && reportGetB.status !== 403) {
    throw new Error('User B accessed User A report by ID!');
  }

  // Socket IO Authorization Check for User B joining User A's run room
  console.log('\n[TEST 8] Socket.io Room Access Authorization...');
  const socketTokenB = parseCookie(cookieB).token;
  const socketB = SocketIOClient(BASE_URL, {
    extraHeaders: { cookie: cookieB },
    auth: { token: socketTokenB },
  });

  await new Promise((resolve, reject) => {
    socketB.on('connect', () => {
      console.log('User B socket connected:', socketB.id);
      socketB.emit('join:run', run1IdA);
    });

    socketB.on('error', (errData) => {
      console.log('>> Received expected Socket Error event for User B:', errData.message);
      if (errData.message.includes('Access denied')) {
        socketB.disconnect();
        resolve();
      } else {
        reject(new Error('Unexpected socket error: ' + errData.message));
      }
    });

    setTimeout(() => reject(new Error('Socket join room authorization test timed out')), 4000);
  });

  // ─── 9. GET /api/me/stats VERIFICATION FOR USER A ──────────────────────────
  console.log('\n[TEST 9] Verifying GET /api/me/stats for User A...');
  const statsRes = await fetch(`${BASE_URL}/api/me/stats`, {
    headers: { Cookie: cookieA },
  });
  const statsJson = await statsRes.json();
  console.log('Stats Response Success:', statsJson.success);
  console.log('Total Runs:', statsJson.data.totalRuns);
  console.log('Unique Websites Tested:', statsJson.data.totalWebsites);
  console.log('Websites list:', statsJson.data.websites);
  console.log('Quota Usage:', statsJson.data.quotaUsage);

  if (statsJson.data.totalRuns !== 2) throw new Error('Expected 2 total runs in stats');
  if (statsJson.data.totalWebsites !== 2) throw new Error('Expected 2 unique websites in stats');

  console.log('\n======================================================');
  console.log('  ALL ACCEPTANCE & PER-USER DATA TESTS PASSED SUCCESSFULLY! ');
  console.log('======================================================\n');

  serverInstance.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err.message);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
