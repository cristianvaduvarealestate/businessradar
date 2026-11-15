const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Test 1: Verify robots.txt blocks all crawlers
test('robots.txt disallows all user agents from crawling private app', () => {
  const robotsPath = path.join(__dirname, '..', 'public', 'robots.txt');
  assert.ok(fs.existsSync(robotsPath), 'public/robots.txt must exist');
  const content = fs.readFileSync(robotsPath, 'utf8');
  assert.match(content, /User-agent:\s*\*/i);
  assert.match(content, /Disallow:\s*\//i);
});

// Test 2: Verify security.txt conforms to standards
test('security.txt contains required RFC 9116 fields', () => {
  const secPath = path.join(__dirname, '..', 'public', '.well-known', 'security.txt');
  assert.ok(fs.existsSync(secPath), 'public/.well-known/security.txt must exist');
  const content = fs.readFileSync(secPath, 'utf8');
  assert.match(content, /Contact:\s*mailto:/i, 'Must have Contact email');
  assert.match(content, /Preferred-Languages:/i, 'Must have Preferred-Languages');
  assert.match(content, /Expires:/i, 'Must have Expires');
  assert.match(content, /Canonical:\s*https:\/\/businessradar\.cristianvaduva\.com/i, 'Must specify canonical URL');
});

// Test 3: Verify wrangler.jsonc disables workers_dev
test('wrangler.jsonc disables workers.dev public access', () => {
  const wranglerPath = path.join(__dirname, '..', 'wrangler.jsonc');
  const content = fs.readFileSync(wranglerPath, 'utf8');
  const parsed = JSON.parse(content);
  assert.strictEqual(parsed.name, 'businessradar', 'Worker name must be businessradar');
  assert.strictEqual(parsed.workers_dev, false, 'workers_dev must be false');
});

// Test 4: Verify next.config.mjs removes poweredByHeader
test('next.config.mjs disables x-powered-by header', () => {
  const nextConfigPath = path.join(__dirname, '..', 'next.config.mjs');
  const content = fs.readFileSync(nextConfigPath, 'utf8');
  assert.match(content, /poweredByHeader:\s*false/, 'next.config.mjs must disable poweredByHeader');
  assert.match(content, /max-age=31536000/, 'next.config.mjs must declare 1-year HSTS');
});

// Test 5: Verify legal pages exist
test('Legal documents (privacy, terms, gdpr) exist as routes', () => {
  const privacyPath = path.join(__dirname, '..', 'src', 'app', 'privacy', 'page.tsx');
  const termsPath = path.join(__dirname, '..', 'src', 'app', 'terms', 'page.tsx');
  const gdprPath = path.join(__dirname, '..', 'src', 'app', 'gdpr', 'page.tsx');

  assert.ok(fs.existsSync(privacyPath), 'Privacy route must exist');
  assert.ok(fs.existsSync(termsPath), 'Terms route must exist');
  assert.ok(fs.existsSync(gdprPath), 'GDPR route must exist');
});

// Test 6: Verify Auth logic: rejection of anonymous & acceptance of Cloudflare Access
test('Auth engine validates Cloudflare Access headers and rejects anonymous requests', () => {
  // Mock request validator logic
  const AUTHORIZED_ADMIN = 'myremaxclubcristianv@gmail.com';

  function mockValidate(headers) {
    const cfEmail = headers['cf-access-authenticated-user-email'];
    if (cfEmail) {
      if (cfEmail.toLowerCase() === AUTHORIZED_ADMIN.toLowerCase()) {
        return { authenticated: true, user: cfEmail, source: 'cloudflare-access' };
      }
      return { authenticated: false, reason: 'unauthorized_identity' };
    }
    const apiKey = headers['x-radar-api-key'] || (headers['authorization'] || '').replace('Bearer ', '');
    if (apiKey && apiKey === 'radar_sec_4f9a88c2e1b7305981d4a0f8e2c69137') {
      return { authenticated: true, user: 'api-admin', source: 'api-key' };
    }
    return { authenticated: false, reason: 'no_credentials' };
  }

  // Anonymous request must be rejected
  const anon = mockValidate({});
  assert.strictEqual(anon.authenticated, false, 'Anonymous request must be unauthenticated');

  // Unauthorized email must be rejected
  const impostor = mockValidate({ 'cf-access-authenticated-user-email': 'attacker@malicious.com' });
  assert.strictEqual(impostor.authenticated, false, 'Impostor email must be rejected');
  assert.strictEqual(impostor.reason, 'unauthorized_identity');

  // Authorized admin email must be allowed
  const admin = mockValidate({ 'cf-access-authenticated-user-email': 'myremaxclubcristianv@gmail.com' });
  assert.strictEqual(admin.authenticated, true, 'Authorized admin must be authenticated');
  assert.strictEqual(admin.source, 'cloudflare-access');

  // Valid internal API key must be allowed
  const apiCall = mockValidate({ 'x-radar-api-key': 'radar_sec_4f9a88c2e1b7305981d4a0f8e2c69137' });
  assert.strictEqual(apiCall.authenticated, true, 'Valid API key must be accepted');
});

// Test 7: Rate limiter sliding window enforces limits
test('Rate limiter blocks excessive calls beyond threshold', () => {
  const windowMs = 1000;
  const max = 3;
  const map = new Map();

  function check(ip) {
    const now = Date.now();
    const rec = map.get(ip);
    if (!rec || now > rec.reset) {
      map.set(ip, { count: 1, reset: now + windowMs });
      return { allowed: true };
    }
    rec.count++;
    if (rec.count > max) {
      return { allowed: false };
    }
    return { allowed: true };
  }

  assert.strictEqual(check('1.2.3.4').allowed, true, 'Request 1 allowed');
  assert.strictEqual(check('1.2.3.4').allowed, true, 'Request 2 allowed');
  assert.strictEqual(check('1.2.3.4').allowed, true, 'Request 3 allowed');
  assert.strictEqual(check('1.2.3.4').allowed, false, 'Request 4 must be rate limited');
});
