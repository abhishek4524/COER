import fetch from 'node-fetch';
import Run from '../models/Run.js';

/**
 * Verify the user owns the URL being tested.
 * Strategy (in order):
 *   1. localhost / 127.0.0.1 in development → auto-pass
 *   2. Check for /personify-verify.txt containing the token
 *   3. Check for <meta name="personify-verify" content="{token}">
 *
 * Used as a standalone helper called by the POST /api/runs/:id/verify-ownership route.
 */

const TIMEOUT_MS = 8000;

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check /personify-verify.txt for the token string.
 */
async function checkTxtFile(baseUrl, token) {
  try {
    const url = new URL('/personify-verify.txt', baseUrl).href;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return false;
    const text = await res.text();
    return text.trim().includes(token);
  } catch {
    return false;
  }
}

/**
 * Check HTML for <meta name="personify-verify" content="{token}">.
 */
async function checkMetaTag(baseUrl, token) {
  try {
    const res = await fetchWithTimeout(baseUrl);
    if (!res.ok) return false;
    const html = await res.text();
    // Simple regex — works for most server-rendered pages
    const metaRegex = /<meta[^>]+name=["']personify-verify["'][^>]+content=["']([^"']+)["']/i;
    const altRegex = /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']personify-verify["']/i;
    const match = html.match(metaRegex) || html.match(altRegex);
    return match ? match[1].trim() === token : false;
  } catch {
    return false;
  }
}

/**
 * Core verification logic. Returns { verified, method }.
 */
export async function verifyOwnership(url, token) {
  const hostname = getHostname(url);
  if (!hostname) return { verified: false, method: null };

  // Dev bypass
  if (process.env.NODE_ENV !== 'production' && isLocalhost(hostname)) {
    return { verified: true, method: 'localhost_bypass' };
  }

  // Try txt file first (faster)
  const txtOk = await checkTxtFile(url, token);
  if (txtOk) return { verified: true, method: 'txt_file' };

  // Try meta tag
  const metaOk = await checkMetaTag(url, token);
  if (metaOk) return { verified: true, method: 'meta_tag' };

  return { verified: false, method: null };
}

/**
 * Express route handler for POST /api/runs/:id/verify-ownership.
 */
export async function verifyOwnershipHandler(req, res, next) {
  try {
    const run = await Run.findById(req.params.id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    const { verified, method } = await verifyOwnership(run.url, run.verificationToken);

    run.ownershipVerified = verified;
    if (verified) {
      run.verificationMethod = method;
      if (run.status === 'pending_verification') run.status = 'queued';
    }
    await run.save();

    res.json({
      success: true,
      verified,
      method,
      status: run.status,
    });
  } catch (err) {
    next(err);
  }
}
