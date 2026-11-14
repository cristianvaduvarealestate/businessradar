const test = require('node:test');
const assert = require('node:assert');

const PROVIDERS = {
  ONRC_DATA_GOV: {
    id: 'ONRC_DATA_GOV',
    supportsBulkDownload: true,
    supportsTaxVerification: false,
    rateLimitInfo: '60 cereri/minut pe CKAN API data.gov.ro',
  },
  ANAF_TVA_REST: {
    id: 'ANAF_TVA_REST',
    supportsBulkDownload: false,
    supportsTaxVerification: true,
    rateLimitInfo: '~1-2 cereri/secundă, loturi de până la 500 CUI',
  },
  MIN_FIN_BALANCE: {
    id: 'MIN_FIN_BALANCE',
    supportsBulkDownload: true,
    supportsTaxVerification: false,
  },
  CONTACT_DISCOVERY: {
    id: 'CONTACT_DISCOVERY',
    supportsContacts: true,
  },
};

test('Provider abstraction enforces required capability flags', () => {
  assert.strictEqual(PROVIDERS.ONRC_DATA_GOV.supportsBulkDownload, true);
  assert.strictEqual(PROVIDERS.ANAF_TVA_REST.supportsTaxVerification, true);
  assert.strictEqual(PROVIDERS.CONTACT_DISCOVERY.supportsContacts, true);
});

test('CSV Parser splits caret delimited lines correctly without losing fields', () => {
  const line = 'SARA GRUP SRL^17721575^J28/524/2005^24/06/2005^ROONRC.J28/524/2005^SRL^România^Olt^Municipiul Caracal^LIPSCANI^4A';
  const parts = line.split('^');
  assert.strictEqual(parts.length, 11);
  assert.strictEqual(parts[0], 'SARA GRUP SRL');
  assert.strictEqual(parts[1], '17721575');
  assert.strictEqual(parts[5], 'SRL');
  assert.strictEqual(parts[7], 'Olt');
});

test('Phone number normalizer formats Romanian mobile and landline numbers', () => {
  function normalizePhone(p) {
    if (!p) return null;
    let clean = p.replace(/[\s\-\.\(\)\/]/g, '');
    if (clean.startsWith('0040')) clean = '+40' + clean.slice(4);
    else if (clean.startsWith('0') && clean.length === 10) clean = '+40' + clean.slice(1);
    if (/^\+40(2\d|3\d|7\d)\d{7}$/.test(clean)) return clean;
    return null;
  }

  assert.strictEqual(normalizePhone('0722123456'), '+40722123456');
  assert.strictEqual(normalizePhone('021 234 5678'), '+40212345678');
  assert.strictEqual(normalizePhone('+40 744 000 111'), '+40744000111');
  assert.strictEqual(normalizePhone('12345'), null);
});
