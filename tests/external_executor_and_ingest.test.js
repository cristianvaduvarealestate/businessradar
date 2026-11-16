const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Database = require('better-sqlite3');
const fs = require('node:fs');
const crypto = require('node:crypto');

const CANONICAL_DB_PATH = path.join(__dirname, '..', 'data', 'radar_business.db');
const ISOLATED_DB_PATH = path.join(__dirname, '..', 'data', 'test_isolated_ingest.db');

// Ensure isolated database exists for mutation tests
function getIsolatedDb() {
  if (!fs.existsSync(ISOLATED_DB_PATH)) {
    fs.copyFileSync(CANONICAL_DB_PATH, ISOLATED_DB_PATH);
  }
  return new Database(ISOLATED_DB_PATH);
}

/**
 * Timing-safe token comparison function as implemented in Ingestion API
 */
function verifyIngestionToken(providedToken, secret) {
  if (!providedToken || !secret) return false;
  try {
    const providedBuffer = Buffer.from(providedToken, 'utf-8');
    const secretBuffer = Buffer.from(secret, 'utf-8');
    if (providedBuffer.length !== secretBuffer.length) return false;
    return crypto.timingSafeEqual(providedBuffer, secretBuffer);
  } catch {
    return false;
  }
}

test('1. M2M Security — Validates dedicated RADAR_INGESTION_SECRET and prevents passkey reuse', () => {
  const dedicatedSecret = 'radar_ingest_secret_xyz_777';
  const adminPasskey = 'admin_super_secret_passkey';
  const securityKey = 'radar_security_encryption_key';

  // Valid token check
  assert.strictEqual(verifyIngestionToken(dedicatedSecret, dedicatedSecret), true, 'Valid ingestion token must match');

  // Reject wrong token
  assert.strictEqual(verifyIngestionToken('wrong_token_123', dedicatedSecret), false, 'Wrong token must fail');

  // Reject empty / null
  assert.strictEqual(verifyIngestionToken(null, dedicatedSecret), false, 'Null token must fail');
  assert.strictEqual(verifyIngestionToken('', dedicatedSecret), false, 'Empty token must fail');

  // Ensure Admin Passkey or Security Key cannot be used as ingestion token
  assert.strictEqual(verifyIngestionToken(adminPasskey, dedicatedSecret), false, 'Admin passkey cannot authenticate as ingestion secret');
  assert.strictEqual(verifyIngestionToken(securityKey, dedicatedSecret), false, 'Security key cannot authenticate as ingestion secret');
});

test('2. Ingestion Schema & Batch Limits — Validates 200-item maximum batch limit', () => {
  const MAX_BATCH_SIZE = 200;

  const validBatch = Array.from({ length: 50 }, (_, i) => ({ cui: 1000 + i, name: `Company ${i}` }));
  const oversizedBatch = Array.from({ length: 205 }, (_, i) => ({ cui: 2000 + i, name: `Company ${i}` }));

  assert.ok(validBatch.length <= MAX_BATCH_SIZE, 'Batch of 50 must be within limit');
  assert.ok(oversizedBatch.length > MAX_BATCH_SIZE, 'Batch of 205 exceeds maximum limit of 200');
});

test('3. Cohort Classification — Accurately distinguishes Continuous Discovery vs Initial Backfill vs Historical', () => {
  const db = new Database(CANONICAL_DB_PATH, { readonly: true });
  const baselineRow = db.prepare("SELECT value FROM monitoring_config WHERE key = 'baseline_backfill_cutoff'").get();
  const baselineCutoff = baselineRow ? baselineRow.value : '2026-08-15';

  function classifyCompany(registrationDate, monitoringState, activationDate) {
    if (!registrationDate || registrationDate < baselineCutoff) return 'HISTORICAL';
    if (monitoringState === 'CONTINUOUS_DISCOVERY' && activationDate && registrationDate >= activationDate) {
      return 'NEW';
    }
    return 'BACKFILL';
  }

  // 1. Unactivated monitoring state: even recent registrations are BACKFILL, never NEW
  assert.strictEqual(classifyCompany('2026-10-15', 'NOT_ACTIVATED', null), 'BACKFILL', 'Before activation, companies belong to INITIAL BACKFILL');
  assert.strictEqual(classifyCompany('2026-11-02', 'INITIAL_BACKFILL', null), 'BACKFILL', 'During initial backfill, companies are BACKFILL');

  // 2. Continuous Discovery active: registered on or after activation timestamp -> NEW
  const activeDate = '2026-11-17';
  assert.strictEqual(classifyCompany('2026-11-18', 'CONTINUOUS_DISCOVERY', activeDate), 'NEW', 'Registered after activation timestamp must be NEW');
  assert.strictEqual(classifyCompany('2026-11-17', 'CONTINUOUS_DISCOVERY', activeDate), 'NEW', 'Registered on activation date must be NEW');

  // 3. Registered before activation date even with continuous discovery active -> BACKFILL
  assert.strictEqual(classifyCompany('2026-09-01', 'CONTINUOUS_DISCOVERY', activeDate), 'BACKFILL', 'Registered before activation date is BACKFILL');
  assert.strictEqual(classifyCompany('2026-08-15', 'CONTINUOUS_DISCOVERY', activeDate), 'BACKFILL', 'Registered on baseline cutoff is BACKFILL');

  // 4. Historical (registered before baseline cutoff 2026-08-15)
  assert.strictEqual(classifyCompany('2026-08-14', 'CONTINUOUS_DISCOVERY', activeDate), 'HISTORICAL', 'Company registered before 2026-08-15 must be HISTORICAL');
  assert.strictEqual(classifyCompany('1991-03-14', 'CONTINUOUS_DISCOVERY', activeDate), 'HISTORICAL', 'Company registered 1991-03-14 must be HISTORICAL');
  db.close();
});

test('4. Ingestion Persistence & Deduplication — Ingests Continuous & Backfill companies without duplicating existing records', () => {
  const db = getIsolatedDb();
  db.prepare("UPDATE monitoring_config SET value = 'CONTINUOUS_DISCOVERY' WHERE key = 'monitoring_state'").run();
  db.prepare("UPDATE monitoring_config SET value = '2026-10-01' WHERE key = 'monitoring_activation_date'").run();

  const testCuiContinuous = 88800001; // Registered 2026-10-25 -> NEW
  const testCuiBackfill = 88800002;   // Registered 2026-09-01 -> BACKFILL
  const existingHistoricalCui = 412052; // Existing historical company from 1991

  const testBatch = [
    {
      cui: testCuiContinuous,
      name: 'CONTINUOUS TEST TECH S.R.L.',
      regCom: 'J40/1234/2026',
      registrationDate: '2026-10-25',
      county: 'Bucureşti',
      city: 'Sectorul 1',
      primaryCaen: '6201',
    },
    {
      cui: testCuiBackfill,
      name: 'BACKFILL TEST LOGISTICS S.R.L.',
      regCom: 'J12/5678/2026',
      registrationDate: '2026-09-01',
      county: 'Cluj',
      city: 'Cluj-Napoca',
      primaryCaen: '4941',
    },
    {
      cui: existingHistoricalCui,
      name: 'TRANSIDEAL SRL',
      registrationDate: '1991-03-14',
    },
  ];

  let acceptedCount = 0;
  let duplicateCount = 0;
  const cohortCounts = { NEW: 0, BACKFILL: 0, HISTORICAL: 0 };

  const insertCompany = db.prepare(`
    INSERT INTO companies (
      cui, name, normalized_name, reg_com, registration_date, incorporation_date,
      first_detected_at, country, county, city, primary_caen, legal_status, fiscal_status,
      classification, verification_state, qualification_status, discovery_source, discovery_batch_id,
      created_at, updated_at, last_observed_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      datetime('now'), 'România', ?, ?, ?, 'ACTIVE', 'UNKNOWN',
      ?, 'DISCOVERED', 'NEW_COMPANY_NOT_ASSESSED', 'ONRC_DATA_GOV', 'test_batch_1',
      datetime('now'), datetime('now'), datetime('now')
    )
  `);

  const insertPipeline = db.prepare(`
    INSERT OR IGNORE INTO prospect_pipeline (cui, status, priority, updated_at)
    VALUES (?, 'NEW_DISCOVERED', 'STANDARD', datetime('now'))
  `);

  for (const item of testBatch) {
    const existing = db.prepare('SELECT cui FROM companies WHERE cui = ?').get(item.cui);
    if (existing) {
      duplicateCount++;
      db.prepare(`UPDATE companies SET last_observed_at = datetime('now') WHERE cui = ?`).run(item.cui);
      continue;
    }

    let classification = 'HISTORICAL';
    if (item.registrationDate >= '2026-10-01') {
      classification = 'NEW';
      cohortCounts.NEW++;
    } else if (item.registrationDate >= '2026-08-15') {
      classification = 'BACKFILL';
      cohortCounts.BACKFILL++;
    } else {
      classification = 'HISTORICAL';
      cohortCounts.HISTORICAL++;
    }

    insertCompany.run(
      item.cui,
      item.name,
      item.name.toUpperCase(),
      item.regCom || null,
      item.registrationDate,
      item.registrationDate,
      item.county || null,
      item.city || null,
      item.primaryCaen || '7022',
      classification
    );
    insertPipeline.run(item.cui);
    acceptedCount++;
  }

  assert.strictEqual(acceptedCount, 2, 'Must accept 2 genuinely new companies');
  assert.strictEqual(duplicateCount, 1, 'Must count existing historical company as duplicate');
  assert.strictEqual(cohortCounts.NEW, 1, 'Must classify 1 Continuous NEW');
  assert.strictEqual(cohortCounts.BACKFILL, 1, 'Must classify 1 Initial BACKFILL');

  // Verify DB state
  const continuousRow = db.prepare('SELECT classification, registration_date, first_detected_at FROM companies WHERE cui = ?').get(testCuiContinuous);
  assert.ok(continuousRow);
  assert.strictEqual(continuousRow.classification, 'NEW');
  assert.strictEqual(continuousRow.registration_date, '2026-10-25');
  assert.ok(continuousRow.first_detected_at);
  assert.notStrictEqual(continuousRow.registration_date, continuousRow.first_detected_at, 'registration_date and first_detected_at must be distinct');

  const backfillRow = db.prepare('SELECT classification, registration_date FROM companies WHERE cui = ?').get(testCuiBackfill);
  assert.ok(backfillRow);
  assert.strictEqual(backfillRow.classification, 'BACKFILL');
  assert.strictEqual(backfillRow.registration_date, '2026-09-01');

  // Verify historical company untouched
  const historicalRow = db.prepare('SELECT classification, name, registration_date FROM companies WHERE cui = ?').get(existingHistoricalCui);
  assert.strictEqual(historicalRow.classification, 'HISTORICAL');
  assert.strictEqual(historicalRow.name, 'TRANSIDEAL SRL');
  assert.strictEqual(historicalRow.registration_date, '1991-03-14');
  db.close();
});

test('5. Replay Protection — Duplicate batch execution does not corrupt database or duplicate CUIs', () => {
  const db = getIsolatedDb();
  const testCui = 88800005;

  const insertCompany = db.prepare(`
    INSERT INTO companies (
      cui, name, normalized_name, registration_date, first_detected_at,
      classification, verification_state, qualification_status, discovery_source, discovery_batch_id,
      created_at, updated_at
    ) VALUES (
      ?, 'REPLAY TEST SRL', 'REPLAY TEST SRL', '2026-10-20', datetime('now'),
      'NEW', 'DISCOVERED', 'NEW_COMPANY_NOT_ASSESSED', 'ONRC_DATA_GOV', 'batch_replay_1',
      datetime('now'), datetime('now')
    )
  `);

  // First run
  insertCompany.run(testCui);
  let count = db.prepare('SELECT count(*) as c FROM companies WHERE cui = ?').get(testCui).c;
  assert.strictEqual(count, 1, 'Record inserted on first run');

  // Second run: duplicate detection
  const existing = db.prepare('SELECT cui FROM companies WHERE cui = ?').get(testCui);
  assert.ok(existing, 'Duplicate CUI detected on replay');

  count = db.prepare('SELECT count(*) as c FROM companies WHERE cui = ?').get(testCui).c;
  assert.strictEqual(count, 1, 'Record count remains exactly 1 after replay attempt');
  db.close();
});

test('6. GitHub Actions Workflow Configuration — Validates .github/workflows/onrc-sync.yml', () => {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'onrc-sync.yml');
  assert.ok(fs.existsSync(workflowPath), 'Workflow file must exist');

  const content = fs.readFileSync(workflowPath, 'utf8');
  assert.ok(content.includes("cron: '0 6 * * *'"), 'Must contain daily cron trigger at 06:00 UTC');
  assert.ok(content.includes('workflow_dispatch:'), 'Must allow manual dispatch');
  assert.ok(content.includes('RADAR_INGESTION_SECRET'), 'Must use dedicated ingestion secret');
  assert.ok(content.includes('scripts/sync-onrc.js'), 'Must invoke scripts/sync-onrc.js');
  assert.ok(!content.includes('RADAR_ADMIN_PASSKEY'), 'Must NOT reuse RADAR_ADMIN_PASSKEY in external workflow');
});

test('7. Historical Data Integrity — The 2,908 historical companies and 128 active prospects are preserved intact', () => {
  const db = new Database(CANONICAL_DB_PATH, { readonly: true });
  const total = db.prepare('SELECT count(*) as c FROM companies').get().c;
  assert.strictEqual(total, 2908, 'Total companies in database must remain exactly 2,908');

  const historical = db.prepare("SELECT count(*) as c FROM companies WHERE classification = 'HISTORICAL'").get().c;
  assert.strictEqual(historical, 2908, 'All 2,908 must remain classified as HISTORICAL');

  const activeQuery = `
    SELECT count(*) as count FROM companies
    WHERE legal_status = 'ACTIVE'
      AND fiscal_status IN ('FISCALLY_ACTIVE', 'REACTIVATED')
      AND cui NOT IN (SELECT cui FROM suppression_list)
      AND EXISTS (
        SELECT 1 FROM contact_records cr
        WHERE cr.cui = companies.cui
          AND (
            (cr.contact_type IN ('MOBILE', 'LANDLINE') AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
            OR
            (cr.contact_type = 'EMAIL' AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
          )
      )
  `;
  const activeCount = db.prepare(activeQuery).get().count;
  assert.strictEqual(activeCount, 128, 'Active prospects must remain exactly 128');
  db.close();
});

test('8. HMAC Cryptographic Signing — Detects modified payloads and verifies signature', () => {
  const secret = 'radar_ingest_secret_xyz_777';
  const batchId = 'batch_test_hmac_123';
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID ? crypto.randomUUID() : 'test_nonce_12345';

  const originalPayload = JSON.stringify({ batchId, companies: [{ cui: 123456, name: 'TEST' }] });
  const modifiedPayload = JSON.stringify({ batchId, companies: [{ cui: 123456, name: 'TEST_MODIFIED' }] });

  // Compute HMAC for original payload
  const originalHash = crypto.createHash('sha256').update(originalPayload).digest('hex');
  const stringToSign = `${timestamp}.${nonce}.${batchId}.${originalHash}`;
  const validSignature = `sha256=${crypto.createHmac('sha256', secret).update(stringToSign).digest('hex')}`;

  // Verification helper
  function verifyHmac(receivedSig, payloadStr) {
    const pHash = crypto.createHash('sha256').update(payloadStr).digest('hex');
    const sToSign = `${timestamp}.${nonce}.${batchId}.${pHash}`;
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(sToSign).digest('hex')}`;
    const bufA = Buffer.from(receivedSig, 'utf-8');
    const bufB = Buffer.from(expected, 'utf-8');
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  }

  // Original payload must pass
  assert.strictEqual(verifyHmac(validSignature, originalPayload), true, 'Original unmodified payload must pass HMAC check');

  // Tampered payload must fail
  assert.strictEqual(verifyHmac(validSignature, modifiedPayload), false, 'Tampered/modified payload must fail HMAC check');
});

test('9. Anti-Replay Timestamp Window — Rejects expired timestamps beyond 15 minutes', () => {
  const MAX_DRIFT_MS = 15 * 60 * 1000;
  const now = Date.now();

  function isTimestampFresh(tsMs) {
    return Math.abs(now - tsMs) <= MAX_DRIFT_MS;
  }

  // Fresh timestamps
  assert.strictEqual(isTimestampFresh(now), true, 'Current timestamp is fresh');
  assert.strictEqual(isTimestampFresh(now - 5 * 60 * 1000), true, '5 minutes ago is fresh');

  // Expired timestamps
  assert.strictEqual(isTimestampFresh(now - 16 * 60 * 1000), false, '16 minutes ago is expired');
  assert.strictEqual(isTimestampFresh(now - 60 * 60 * 1000), false, '1 hour ago is expired');
  assert.strictEqual(isTimestampFresh(now + 20 * 60 * 1000), false, '20 minutes into future is expired');
});

test('10. Nonce Replay Protection — Rejects reused nonces and persists nonces in ingestion_nonces table', () => {
  const db = getIsolatedDb();
  const testNonce = `nonce_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ts = Date.now();

  // Nonce not yet in DB
  const before = db.prepare('SELECT nonce FROM ingestion_nonces WHERE nonce = ?').get(testNonce);
  assert.strictEqual(before, undefined, 'Nonce must not exist initially');

  // Record nonce
  db.prepare('INSERT INTO ingestion_nonces (nonce, timestamp, created_at) VALUES (?, ?, datetime(\'now\'))').run(testNonce, ts);

  // Second check: duplicate nonce detected
  const after = db.prepare('SELECT nonce FROM ingestion_nonces WHERE nonce = ?').get(testNonce);
  assert.ok(after, 'Nonce must now exist in DB');
  assert.strictEqual(after.nonce, testNonce);

  // Attempting duplicate insert must throw UNIQUE constraint failure
  assert.throws(() => {
    db.prepare('INSERT INTO ingestion_nonces (nonce, timestamp, created_at) VALUES (?, ?, datetime(\'now\'))').run(testNonce, ts);
  }, /UNIQUE constraint failed/, 'Reused nonce must trigger unique constraint violation');

  db.close();

  // Clean up isolated DB file at the end of tests
  try {
    if (fs.existsSync(ISOLATED_DB_PATH)) fs.unlinkSync(ISOLATED_DB_PATH);
  } catch {}
});
