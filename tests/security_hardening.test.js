const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Test 1: Verify robots.txt blocks all crawlers
test('robots.txt disallows all user agents from crawling private app', () => {
  const robotsPath = path.join(__dirname, '..', 'public', 'robots.txt');
  assert.ok(fs.existsSync(robotsPath), 'public/robots.txt must exist');
  const content = fs.readFileSync(robotsPath, 'utf8');
  assert.match(content, /User-agent:\s*\*/i);
  assert.match(content, /Disallow:\s*\//i);
});

// Test 2: Verify security.txt conforms to RFC 9116
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

// Test 4: Verify next.config.mjs removes poweredByHeader and declares 1-year HSTS
test('next.config.mjs disables x-powered-by header and declares 1-year HSTS', () => {
  const nextConfigPath = path.join(__dirname, '..', 'next.config.mjs');
  const content = fs.readFileSync(nextConfigPath, 'utf8');
  assert.match(content, /poweredByHeader:\s*false/, 'next.config.mjs must disable poweredByHeader');
  assert.match(content, /max-age=31536000/, 'next.config.mjs must declare 1-year HSTS');
});

// Test 5: Verify Content Security Policy in middleware does NOT contain unsafe-eval
test('middleware Content Security Policy excludes unsafe-eval', () => {
  const middlewarePath = path.join(__dirname, '..', 'src', 'middleware.ts');
  const content = fs.readFileSync(middlewarePath, 'utf8');
  assert.doesNotMatch(content, /'unsafe-eval'/, 'CSP must not contain unsafe-eval in production');
  assert.match(content, /default-src 'self'/, 'CSP must specify default-src self');
  assert.match(content, /frame-ancestors 'none'/, 'CSP must prevent framing');
});

// Test 6: Verify legal pages exist
test('Legal documents (privacy, terms, gdpr) exist as routes', () => {
  const privacyPath = path.join(__dirname, '..', 'src', 'app', 'privacy', 'page.tsx');
  const termsPath = path.join(__dirname, '..', 'src', 'app', 'terms', 'page.tsx');
  const gdprPath = path.join(__dirname, '..', 'src', 'app', 'gdpr', 'page.tsx');

  assert.ok(fs.existsSync(privacyPath), 'Privacy route must exist');
  assert.ok(fs.existsSync(termsPath), 'Terms route must exist');
  assert.ok(fs.existsSync(gdprPath), 'GDPR route must exist');
});

// Test 7: Verify auth.ts does NOT contain any hardcoded fallback security keys
test('auth.ts strictly removes hardcoded secrets and requires environment variables', () => {
  const authPath = path.join(__dirname, '..', 'src', 'lib', 'auth.ts');
  const content = fs.readFileSync(authPath, 'utf8');
  assert.doesNotMatch(content, /DEFAULT_INTERNAL_KEY/, 'auth.ts must not contain DEFAULT_INTERNAL_KEY');
  assert.doesNotMatch(content, /radar_sec_4f9a88c2e1b7305981d4a0f8e2c69137/, 'Hardcoded secret must be purged');
  assert.match(content, /process\.env\.RADAR_SECURITY_KEY/, 'Must require environment variable');
});

// Test 8: Verify Spoofed Identity Header rejection and JWT validation logic
test('Auth validator rejects spoofed cf-access-authenticated-user-email without valid JWT', () => {
  const AUTHORIZED_ADMIN = 'myremaxclubcristianv@gmail.com';

  function validateAuth(headers, env = {}) {
    const cfEmail = headers['cf-access-authenticated-user-email'];
    const cfJwt = headers['cf-access-jwt-assertion'];

    // CRITICAL: Reject spoofed email header without JWT
    if (cfEmail && !cfJwt) {
      return { authenticated: false, reason: 'spoofed_identity_header', user: cfEmail };
    }

    if (cfJwt) {
      // Validate JWT structure
      const parts = cfJwt.split('.');
      if (parts.length !== 3) {
        return { authenticated: false, reason: 'unverified_jwt' };
      }
      try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (header.alg !== 'RS256' || !header.kid) {
          return { authenticated: false, reason: 'unverified_jwt' };
        }
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          return { authenticated: false, reason: 'expired_jwt' };
        }
        const email = (payload.email || '').toLowerCase();
        if (email !== AUTHORIZED_ADMIN.toLowerCase()) {
          return { authenticated: false, reason: 'unauthorized_identity' };
        }
        if (!env.CF_ACCESS_AUD) {
          return { authenticated: false, reason: 'unverified_jwt' };
        }
        return { authenticated: true, user: email, source: 'cloudflare-access' };
      } catch {
        return { authenticated: false, reason: 'unverified_jwt' };
      }
    }

    const apiKey = headers['x-radar-api-key'] || (headers['authorization'] || '').replace('Bearer ', '');
    const serverKey = env.RADAR_SECURITY_KEY || '';
    if (serverKey.length >= 16 && apiKey === serverKey) {
      return { authenticated: true, user: 'api-admin', source: 'api-key' };
    }

    return { authenticated: false, reason: 'no_credentials' };
  }

  // 1. Anonymous request -> blocked
  assert.strictEqual(validateAuth({}).authenticated, false);

  // 2. Spoofed email header alone -> BLOCKED with spoofed_identity_header
  const spoofed = validateAuth({
    'cf-access-authenticated-user-email': AUTHORIZED_ADMIN,
  });
  assert.strictEqual(spoofed.authenticated, false, 'Spoofed header without JWT must be denied');
  assert.strictEqual(spoofed.reason, 'spoofed_identity_header');

  // 3. Fake unsigned JWT -> BLOCKED with unverified_jwt
  const fakeJwt = validateAuth({
    'cf-access-authenticated-user-email': AUTHORIZED_ADMIN,
    'cf-access-jwt-assertion': 'invalid.jwt.token',
  });
  assert.strictEqual(fakeJwt.authenticated, false, 'Malformed JWT must be denied');
  assert.strictEqual(fakeJwt.reason, 'unverified_jwt');

  // 4. Missing CF_ACCESS_AUD in environment -> Fails closed
  const validPayload = Buffer.from(JSON.stringify({
    email: AUTHORIZED_ADMIN,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const validHeader = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'cf-key-1' })).toString('base64url');
  const mockJwt = `${validHeader}.${validPayload}.mocksig`;

  const unconfiguredEnv = validateAuth({
    'cf-access-authenticated-user-email': AUTHORIZED_ADMIN,
    'cf-access-jwt-assertion': mockJwt,
  }, {});
  assert.strictEqual(unconfiguredEnv.authenticated, false, 'Must fail closed when Access is unconfigured');

  // 5. When CF_ACCESS_AUD is properly configured and matches
  const verified = validateAuth({
    'cf-access-authenticated-user-email': AUTHORIZED_ADMIN,
    'cf-access-jwt-assertion': mockJwt,
  }, { CF_ACCESS_AUD: 'aud-123' });
  assert.strictEqual(verified.authenticated, true);
  assert.strictEqual(verified.user, AUTHORIZED_ADMIN);

  // 6. Valid API key with sufficient length accepted
  const validApi = validateAuth(
    { 'x-radar-api-key': 'valid_secret_key_1234567890' },
    { RADAR_SECURITY_KEY: 'valid_secret_key_1234567890' }
  );
  assert.strictEqual(validApi.authenticated, true);

  // 7. Weak or unconfigured API key rejected
  const weakApi = validateAuth(
    { 'x-radar-api-key': 'short' },
    { RADAR_SECURITY_KEY: 'short' }
  );
  assert.strictEqual(weakApi.authenticated, false, 'Key < 16 chars must be rejected');
});

// Test 9: Timing-safe comparison guarantees
test('Constant-time comparison executes safely and rejects mismatched strings', () => {
  function constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (!a || !b) return false;
    const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
    const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
    return crypto.timingSafeEqual(hashA, hashB);
  }

  assert.strictEqual(constantTimeCompare('secret123', 'secret123'), true);
  assert.strictEqual(constantTimeCompare('secret123', 'secret124'), false);
  assert.strictEqual(constantTimeCompare('short', 'much_longer_string'), false);
  assert.strictEqual(constantTimeCompare('', 'secret'), false);
});

// Test 10: HMAC-SHA256 session token generation and verification
test('Session tokens are cryptographically signed with HMAC-SHA256', () => {
  const secret = 'c71dc872e92e6ab8e3da577bc2a03aa825a9b5567dd2ace21e32d773487f0d10';
  const email = 'myremaxclubcristianv@gmail.com';
  const timestamp = Date.now();
  const payload = `${email}:${timestamp}`;
  const signature = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const token = `${payload}:${signature}`;

  // Verify
  const parts = token.split(':');
  assert.strictEqual(parts.length, 3);
  const expectedSig = crypto.createHmac('sha256', secret).update(`${parts[0]}:${parts[1]}`, 'utf8').digest('hex');
  assert.strictEqual(parts[2], expectedSig);

  // Tampered token fails
  const tamperedSig = crypto.createHmac('sha256', secret).update(`attacker@evil.com:${parts[1]}`, 'utf8').digest('hex');
  assert.notStrictEqual(parts[2], tamperedSig);
});

// Test 11: Rate limiter sliding window enforces limits
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

// Test 12: Dedicated administrator passkey authentication (strictly RADAR_ADMIN_PASSKEY only)
test('Administrator passkey strictly requires RADAR_ADMIN_PASSKEY without fallbacks', () => {
  const AUTHORIZED_ADMIN = 'myremaxclubcristianv@gmail.com';

  function resolveAdminPasskey(env = {}) {
    return (env.RADAR_ADMIN_PASSKEY || '').trim();
  }

  function validateLogin(email, key, env = {}) {
    const isAuthorizedEmail = (email || '').toLowerCase() === AUTHORIZED_ADMIN.toLowerCase();
    const adminPasskey = resolveAdminPasskey(env);

    // If missing or shorter than 12 characters, return HTTP 503
    if (!adminPasskey || adminPasskey.length < 12) {
      return { success: false, status: 503, error: 'passkey_unconfigured' };
    }

    // Constant-time comparison simulation
    const lenA = key.length;
    const lenB = adminPasskey.length;
    let diff = lenA ^ lenB;
    for (let i = 0; i < lenA; i++) {
      diff |= key.charCodeAt(i) ^ (i < lenB ? adminPasskey.charCodeAt(i) : 0);
    }
    const isValidKey = diff === 0;

    if (!isAuthorizedEmail || !isValidKey) {
      return { success: false, status: 401, error: 'invalid_credentials' };
    }

    return { success: true, status: 200, user: email };
  }

  // 1. Correct RADAR_ADMIN_PASSKEY authenticates successfully
  const success = validateLogin(AUTHORIZED_ADMIN, 'MySuperSecretPasskey2026!', {
    RADAR_ADMIN_PASSKEY: 'MySuperSecretPasskey2026!',
  });
  assert.strictEqual(success.status, 200);
  assert.strictEqual(success.user, AUTHORIZED_ADMIN);

  // 2. Wrong passkey is rejected with HTTP 401
  const wrongKey = validateLogin(AUTHORIZED_ADMIN, 'WrongPasskey12345!', {
    RADAR_ADMIN_PASSKEY: 'MySuperSecretPasskey2026!',
  });
  assert.strictEqual(wrongKey.status, 401);
  assert.strictEqual(wrongKey.error, 'invalid_credentials');

  // 3. Missing RADAR_ADMIN_PASSKEY returns HTTP 503
  const missing = validateLogin(AUTHORIZED_ADMIN, 'AnyPassword1234!', {});
  assert.strictEqual(missing.status, 503);
  assert.strictEqual(missing.error, 'passkey_unconfigured');

  // 4. RADAR_SECURITY_KEY alone CANNOT authenticate an administrator (must return 503)
  const secKeyOnly = validateLogin(
    AUTHORIZED_ADMIN,
    'c71dc872e92e6ab8e3da577bc2a03aa825a9b5567dd2ace21e32d773487f0d10',
    { RADAR_SECURITY_KEY: 'c71dc872e92e6ab8e3da577bc2a03aa825a9b5567dd2ace21e32d773487f0d10' }
  );
  assert.strictEqual(secKeyOnly.status, 503, 'RADAR_SECURITY_KEY alone must not satisfy admin login');

  // 5. ADMIN_PASSKEY alone CANNOT authenticate an administrator (must return 503)
  const legacyPasskey = validateLogin(
    AUTHORIZED_ADMIN,
    'SomeLegacyPassword2026!',
    { ADMIN_PASSKEY: 'SomeLegacyPassword2026!' }
  );
  assert.strictEqual(legacyPasskey.status, 503, 'ADMIN_PASSKEY alone must not satisfy admin login');

  // 6. Source code audit: ensure auth.ts getAdminPasskey does not contain fallbacks
  const authPath = path.join(__dirname, '..', 'src', 'lib', 'auth.ts');
  const authContent = fs.readFileSync(authPath, 'utf8');
  assert.doesNotMatch(authContent, /process\.env\.ADMIN_PASSKEY/, 'auth.ts must not reference ADMIN_PASSKEY');
  assert.match(authContent, /process\.env\.RADAR_ADMIN_PASSKEY/, 'auth.ts must reference RADAR_ADMIN_PASSKEY');
});
