import { URL } from 'url';
import net from 'net';

/**
 * Checks whether an IP address belongs to a private, loopback, or cloud metadata range.
 */
export function isPrivateOrInternalIP(ip) {
  if (!ip) return false;

  // Cloud metadata IP (AWS/GCP/Azure)
  if (ip === '169.254.169.254' || ip === '169.254.169.253') return true;

  // IPv4 Loopback
  if (ip.startsWith('127.')) return true;
  if (ip === '0.0.0.0') return true;

  // IPv4 Private Ranges
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;

  // 172.16.0.0 - 172.31.255.255
  if (ip.startsWith('172.')) {
    const parts = ip.split('.').map(Number);
    if (parts[1] >= 16 && parts[1] <= 31) return true;
  }

  // IPv6 Link-local / Loopback
  if (ip === '::1' || ip === '::' || ip.toLowerCase().startsWith('fe80:') || ip.toLowerCase().startsWith('fc00:')) {
    return true;
  }

  return false;
}

/**
 * Validates target URL for SSRF vulnerabilities before initiating Playwright simulations.
 * Throws an Error if URL is invalid, unsafe, or attempts SSRF against internal/metadata IPs.
 */
export function validateTargetUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new Error('Website URL is required.');
  }

  let parsed;
  try {
    const urlWithProtocol = /^https?:\/\//i.test(inputUrl.trim())
      ? inputUrl.trim()
      : `https://${inputUrl.trim()}`;
    parsed = new URL(urlWithProtocol);
  } catch {
    throw new Error('Invalid URL format. Please provide a valid web address.');
  }

  // Scheme protection: Only http: and https: are allowed
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden scheme '${parsed.protocol}'. Only http:// and https:// URLs are allowed.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const isProd = process.env.NODE_ENV === 'production';

  // Always block AWS/GCP/Azure IMDS metadata IP (169.254.169.254) regardless of env
  if (hostname === '169.254.169.254' || hostname === '169.254.169.253') {
    throw new Error('Security Error: Access to cloud metadata service (169.254.169.254) is strictly prohibited.');
  }

  // If direct IP address entered, check if private
  if (net.isIP(hostname)) {
    if (isPrivateOrInternalIP(hostname)) {
      if (!isProd && (hostname === '127.0.0.1' || hostname === 'localhost')) {
        // Allow localhost in dev
      } else {
        throw new Error(`Security Error: Access to internal IP address '${hostname}' is prohibited (SSRF Protection).`);
      }
    }
  }

  // Domain checks in production
  if (isProd) {
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      throw new Error(`Security Error: Access to internal hostname '${hostname}' is prohibited in production.`);
    }
  }

  return parsed.href;
}
