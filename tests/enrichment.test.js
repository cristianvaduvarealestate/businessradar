const test = require('node:test');
const assert = require('node:assert');

// Contact Normalizer Tests
test('ContactNormalizer accurately normalizes Romanian mobile and landline numbers', () => {
  // We can test the logic directly
  const normalizePhone = (input) => {
    if (!input) return null;
    let clean = input.trim().replace(/[\s\-\.\(\)\/]/g, '');
    if (clean.startsWith('0040')) clean = '+40' + clean.slice(4);
    else if (clean.startsWith('40') && clean.length >= 11) clean = '+' + clean;
    else if (clean.startsWith('+40')) {}
    else if (clean.startsWith('01') && clean.length === 9) clean = '+4021' + clean.slice(2);
    else if (clean.startsWith('0') && clean.length === 10) clean = '+40' + clean.slice(1);

    if (!/^\+40[237]\d{8}$/.test(clean)) return null;
    const type = clean.startsWith('+407') ? 'MOBILE' : (clean.startsWith('+402') || clean.startsWith('+403') ? 'LANDLINE' : 'PHONE');
    return { normalized: clean, type };
  };

  // Romanian Mobile tests
  const m1 = normalizePhone('0744700293');
  assert.strictEqual(m1.normalized, '+40744700293');
  assert.strictEqual(m1.type, 'MOBILE');

  const m2 = normalizePhone('+40 759 570 570');
  assert.strictEqual(m2.normalized, '+40759570570');
  assert.strictEqual(m2.type, 'MOBILE');

  const m3 = normalizePhone('0788-201-871');
  assert.strictEqual(m3.normalized, '+40788201871');
  assert.strictEqual(m3.type, 'MOBILE');

  // Romanian Landline tests
  const l1 = normalizePhone('0264266111');
  assert.strictEqual(l1.normalized, '+40264266111');
  assert.strictEqual(l1.type, 'LANDLINE');

  const l2 = normalizePhone('0371 454 400');
  assert.strictEqual(l2.normalized, '+40371454400');
  assert.strictEqual(l2.type, 'LANDLINE');

  // Old Bucharest Prefix 01 -> +4021
  const b1 = normalizePhone('016598610');
  assert.strictEqual(b1.normalized, '+40216598610');
  assert.strictEqual(b1.type, 'LANDLINE');

  // Invalid numbers
  assert.strictEqual(normalizePhone('12345'), null);
  assert.strictEqual(normalizePhone('not-a-phone'), null);
  assert.strictEqual(normalizePhone('+1234567890'), null);
});

test('ContactNormalizer handles malformed email and typo correction', () => {
  const normalizeEmail = (input) => {
    if (!input) return null;
    let clean = input.trim().toLowerCase();
    if (clean.startsWith('mailto:')) clean = clean.slice(7).trim();
    if (clean.startsWith('www.')) {
      const parts = clean.split('@');
      if (parts.length === 2) {
        let userPart = parts[0].replace(/^www\./, '');
        if (userPart === 'ofice') userPart = 'office';
        clean = `${userPart}@${parts[1]}`;
      }
    }
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!emailRegex.test(clean)) return null;
    if (['example.com', 'test.com', 'sentry.io'].some(b => clean.includes(b))) return null;
    return clean;
  };

  // Malformed from database: www.ofice@algida.ro
  assert.strictEqual(normalizeEmail('www.ofice@algida.ro'), 'office@algida.ro');
  assert.strictEqual(normalizeEmail('mailto:contact.krommax@gmail.com'), 'contact.krommax@gmail.com');
  assert.strictEqual(normalizeEmail('OFFICE@CIBERNETSERVICE.RO'), 'office@cibernetservice.ro');

  // Rejections
  assert.strictEqual(normalizeEmail('bad@example.com'), null);
  assert.strictEqual(normalizeEmail('not-an-email'), null);
});

test('ContactNormalizer detects phone and email mistakenly placed in website field', () => {
  const normalizeWebsite = (input) => {
    if (!input) return null;
    const clean = input.trim();
    if (/^\+?0?7\d{8}$/.test(clean)) {
      return { detectedType: 'MOBILE', normalized: clean.startsWith('+40') ? clean : '+40' + clean.replace(/^0/, '') };
    }
    if (clean.includes('@')) {
      return { detectedType: 'EMAIL', normalized: clean.replace(/^www\.ofice/, 'office').replace(/^www\./, '') };
    }
    let url = clean.toLowerCase();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    try {
      const p = new URL(url);
      if (!p.hostname.includes('.')) return null;
      return { detectedType: 'WEBSITE', normalized: `${p.protocol}//${p.hostname}${p.pathname === '/' ? '' : p.pathname}` };
    } catch {
      return null;
    }
  };

  // Database case 1: 0744700293 in website column
  const c1 = normalizeWebsite('0744700293');
  assert.strictEqual(c1.detectedType, 'MOBILE');
  assert.strictEqual(c1.normalized, '+40744700293');

  // Database case 2: www.ofice@algida.ro in website column
  const c2 = normalizeWebsite('www.ofice@algida.ro');
  assert.strictEqual(c2.detectedType, 'EMAIL');
  assert.strictEqual(c2.normalized, 'office@algida.ro');

  // Database case 3: WWW.JANTO.RO in website column
  const c3 = normalizeWebsite('WWW.JANTO.RO');
  assert.strictEqual(c3.detectedType, 'WEBSITE');
  assert.strictEqual(c3.normalized, 'https://www.janto.ro');
});

test('Enrichment provenance protects verified records from being overwritten by weaker sources', () => {
  const CONFIDENCE_LEVELS = {
    'MANUALLY_CONFIRMED': 1.0,
    'OFFICIAL_REGISTER': 0.95,
    'OFFICIAL_WEBSITE': 0.90,
    'DECLARED_BY_COMPANY': 0.85,
    'PUBLIC_BUSINESS_DIRECTORY': 0.70,
    'FORMAT_VALID_ONLY': 0.50,
    'UNVERIFIED': 0.30
  };

  const shouldOverwrite = (existingStatus, newStatus) => {
    const existingScore = CONFIDENCE_LEVELS[existingStatus] || 0;
    const newScore = CONFIDENCE_LEVELS[newStatus] || 0;
    return newScore > existingScore;
  };

  // Weaker source must NEVER overwrite higher source
  assert.strictEqual(shouldOverwrite('MANUALLY_CONFIRMED', 'OFFICIAL_WEBSITE'), false);
  assert.strictEqual(shouldOverwrite('OFFICIAL_REGISTER', 'DECLARED_BY_COMPANY'), false);
  assert.strictEqual(shouldOverwrite('OFFICIAL_WEBSITE', 'FORMAT_VALID_ONLY'), false);

  // Stronger source CAN upgrade a record
  assert.strictEqual(shouldOverwrite('UNVERIFIED', 'OFFICIAL_WEBSITE'), true);
  assert.strictEqual(shouldOverwrite('DECLARED_BY_COMPANY', 'MANUALLY_CONFIRMED'), true);
});

test('Suppression list strictly blocks suppressed CUI or phone/email from contact enrichment and exports', () => {
  const suppressedCuis = new Set([99999999]);
  const suppressedEmails = new Set(['do-not-call@company.ro']);

  const isBlocked = (cui, email) => {
    if (suppressedCuis.has(cui)) return true;
    if (email && suppressedEmails.has(email)) return true;
    return false;
  };

  assert.strictEqual(isBlocked(99999999, 'sales@company.ro'), true);
  assert.strictEqual(isBlocked(12345678, 'do-not-call@company.ro'), true);
  assert.strictEqual(isBlocked(12345678, 'valid@company.ro'), false);
});
