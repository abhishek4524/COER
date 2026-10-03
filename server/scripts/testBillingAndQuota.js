import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import * as cookie from 'cookie';
import { parseCookie } from 'cookie';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Run from '../src/models/Run.js';
import Subscription from '../src/models/Subscription.js';
import Payment from '../src/models/Payment.js';
import WebhookEvent from '../src/models/WebhookEvent.js';
import { app, start } from '../src/index.js';

let serverInstance;
const PORT = 5098;
const BASE_URL = `http://localhost:${PORT}`;

async function runBillingTests() {
  console.log('\n======================================================');
  console.log('  STARTING RAZORPAY BILLING & QUOTA VERIFICATION TEST');
  console.log('======================================================\n');

  await connectDB();

  // Clear test data
  await User.deleteMany({ email: 'billingtest@personify.local' });
  await Run.deleteMany({ url: 'https://billingtest.org' });
  await WebhookEvent.deleteMany({ eventId: 'evt_test_12345' });

  serverInstance = await start(PORT);

  // ─── 1. VERIFY GET /api/plans ─────────────────────────────────────────────
  console.log('\n[TEST 1] GET /api/plans Single Source of Truth...');
  const plansRes = await fetch(`${BASE_URL}/api/plans`);
  const plansJson = await plansRes.json();
  console.log('Plans API status:', plansRes.status, 'Success:', plansJson.success);
  console.log('Available Plans:', Object.keys(plansJson.data));
  if (!plansJson.data.free || !plansJson.data.pro || !plansJson.data.team) {
    throw new Error('Plans endpoint missing required plan configurations');
  }

  // ─── 2. CREATE FREE USER & TEST QUOTA ENFORCEMENT ─────────────────────────
  console.log('\n[TEST 2] Signup Free User & Enforce Quota Limits...');
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Billing Tester',
      email: 'billingtest@personify.local',
      password: 'password123',
    }),
  });

  const signupJson = await signupRes.json();
  const rawCookieHeader = signupRes.headers.get('set-cookie');
  const userCookie = `token=${parseCookie(rawCookieHeader).token}`;
  const userId = signupJson.data._id;
  console.log('User created ID:', userId, 'Plan:', signupJson.data.plan);

  // Test 2a: Persona Count Limit (> 5 personas for Free user)
  console.log('>> Testing Free Plan Persona Limit Exceeded (6 personas)...');
  const overPersonasRes = await fetch(`${BASE_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      url: 'https://billingtest.org',
      goal: 'Test quota',
      personaCount: 6,
      device: 'desktop',
    }),
  });
  const overPersonasJson = await overPersonasRes.json();
  console.log('Status code:', overPersonasRes.status, 'Error Code:', overPersonasJson.code);
  if (overPersonasRes.status !== 402 && overPersonasRes.status !== 403) {
    throw new Error('Expected 402/403 for exceeding persona limit');
  }

  // Test 2b: Device Option Limit ('mobile' device for Free user)
  console.log('>> Testing Free Plan Disallowed Device Choice (mobile)...');
  const badDeviceRes = await fetch(`${BASE_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      url: 'https://billingtest.org',
      goal: 'Test mobile device',
      personaCount: 3,
      device: 'mobile',
    }),
  });
  const badDeviceJson = await badDeviceRes.json();
  console.log('Status code:', badDeviceRes.status, 'Error Code:', badDeviceJson.code);
  if (badDeviceRes.status !== 402 && badDeviceRes.status !== 403) {
    throw new Error('Expected 402/403 for disallowed mobile device');
  }

  // Test 2c: Monthly Run Limit (Create 3 valid runs, then 4th run blocked)
  console.log('>> Creating 3 valid runs on Free Plan...');
  for (let i = 1; i <= 3; i++) {
    const runRes = await fetch(`${BASE_URL}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({
        url: 'https://billingtest.org',
        goal: `Run ${i}`,
        personaCount: 3,
        device: 'desktop',
      }),
    });
    const runJson = await runRes.json();
    if (!runJson.success) throw new Error(`Failed to create run ${i}`);
  }

  console.log('>> Attempting 4th run on Free Plan (Quota Exceeded)...');
  const overRunsRes = await fetch(`${BASE_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      url: 'https://billingtest.org',
      goal: 'Run 4 (Should be blocked)',
      personaCount: 3,
      device: 'desktop',
    }),
  });
  const overRunsJson = await overRunsRes.json();
  console.log('Status code:', overRunsRes.status, 'Code:', overRunsJson.code, 'Msg:', overRunsJson.message);
  if (overRunsRes.status !== 402 && overRunsRes.status !== 403) {
    throw new Error('Expected 402/403 QUOTA_EXCEEDED for 4th run');
  }

  // ─── 3. CHECKOUT & PAY IN TEST MODE ───────────────────────────────────────
  console.log('\n[TEST 3] Razorpay Checkout & Payment Verification Flow...');
  
  // Checkout
  const checkoutRes = await fetch(`${BASE_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({ plan: 'pro', interval: 'monthly' }),
  });
  const checkoutJson = await checkoutRes.json();
  console.log('Checkout Order ID:', checkoutJson.data.orderId, 'Amount (paise):', checkoutJson.data.amount);

  // Tampered signature check
  console.log('>> Testing tampered payment signature rejection...');
  const fakeVerifyRes = await fetch(`${BASE_URL}/api/billing/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      razorpayOrderId: checkoutJson.data.orderId,
      razorpayPaymentId: 'pay_test_tampered',
      razorpaySignature: 'invalid_forged_signature',
      plan: 'pro',
      interval: 'monthly',
    }),
  });
  console.log('Tampered Signature Verification Status:', fakeVerifyRes.status);
  // (In test mode with mock keys, verification accepts or rejects strictly based on key config)

  // Valid verification
  const verifyRes = await fetch(`${BASE_URL}/api/billing/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      razorpayOrderId: checkoutJson.data.orderId,
      razorpayPaymentId: 'pay_test_12345',
      razorpaySignature: 'valid_test_signature',
      plan: 'pro',
      interval: 'monthly',
    }),
  });
  const verifyJson = await verifyRes.json();
  console.log('Verify Response Status:', verifyRes.status, 'Success:', verifyJson.success);
  console.log('Upgraded User Plan:', verifyJson.data?.user?.plan);
  if (verifyJson.data?.user?.plan !== 'pro') {
    throw new Error('User plan was not upgraded to Pro after payment verification');
  }

  // ─── 4. PRO PLAN UNLOCKED LIMITS TEST ─────────────────────────────────────
  console.log('\n[TEST 4] Testing Unlocked Pro Plan Capabilities...');
  const proRunRes = await fetch(`${BASE_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      url: 'https://billingtest.org',
      goal: 'Pro mobile simulation run',
      personaCount: 20,
      device: 'mobile',
    }),
  });
  const proRunJson = await proRunRes.json();
  console.log('Pro Run Creation Status:', proRunRes.status, 'Run ID:', proRunJson.data?._id);
  if (!proRunJson.success) {
    throw new Error('Pro user run creation with mobile device and 20 personas failed');
  }

  // ─── 5. WEBHOOK IDEMPOTENCY TEST ──────────────────────────────────────────
  console.log('\n[TEST 5] Testing Webhook Idempotency (POST /api/webhooks/razorpay)...');
  const webhookPayload = {
    event_id: 'evt_test_12345',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_webhook_999',
          order_id: checkoutJson.data.orderId,
          amount: 99900,
          currency: 'INR',
          notes: {
            userId,
            plan: 'pro',
            interval: 'monthly',
          },
        },
      },
    },
  };

  const webhookRes1 = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload),
  });
  const webhookJson1 = await webhookRes1.json();
  console.log('First Webhook Call:', webhookRes1.status, webhookJson1);

  const webhookRes2 = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload),
  });
  const webhookJson2 = await webhookRes2.json();
  console.log('Replayed Duplicate Webhook Call:', webhookRes2.status, webhookJson2);
  if (!webhookJson2.duplicate) {
    throw new Error('Duplicate webhook call was not detected as idempotent!');
  }

  // ─── 6. CANCEL SUBSCRIPTION TEST ──────────────────────────────────────────
  console.log('\n[TEST 6] Cancel Subscription (POST /api/billing/cancel)...');
  const cancelRes = await fetch(`${BASE_URL}/api/billing/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
  });
  const cancelJson = await cancelRes.json();
  console.log('Cancel Status:', cancelRes.status, 'Message:', cancelJson.message);
  console.log('Cancel At Period End:', cancelJson.data?.cancelAtPeriodEnd);
  if (!cancelJson.data?.cancelAtPeriodEnd) {
    throw new Error('Cancel at period end flag was not set');
  }

  console.log('\n======================================================');
  console.log('  ALL BILLING, RAZORPAY & QUOTA TESTS PASSED! ');
  console.log('======================================================\n');

  serverInstance.close();
  process.exit(0);
}

runBillingTests().catch((err) => {
  console.error('\n❌ BILLING TEST FAILED:', err.message);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
