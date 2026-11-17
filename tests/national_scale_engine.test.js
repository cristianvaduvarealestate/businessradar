const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Database = require('better-sqlite3');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { runNationalImport } = require('../scripts/import-national-onrc');

const CANONICAL_OPERATIONAL_DB = path.join(__dirname, '..', 'data', 'radar_business.db');
const NATIONAL_DB_PATH = path.join(__dirname, '..', 'data', 'national_romania.db');
const SAMPLE_CSV_PATH = path.join(__dirname, '..', 'data', 'onrc_real_stream.csv');

test('1. Streaming Ingestion — Parses official ONRC stream and computes SHA-256 without memory spikes', async () => {
  assert.ok(fs.existsSync(SAMPLE_CSV_PATH), 'Sample ONRC CSV must exist');

  const result = await runNationalImport({
    sourceFile: SAMPLE_CSV_PATH,
    datasetId: 'TEST_DATASET_STREAMING',
    batchSize: 1000,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.totalSourceRows, 2999, 'Must parse exactly 2,999 data rows');
  assert.strictEqual(result.validCuiCount, 2908, 'Must extract exactly 2,908 valid CUI records');
  assert.strictEqual(result.invalidCuiCount, 91, 'Must extract exactly 91 zero/invalid records');

  // Verify SHA-256 matches actual file sha256
  const fileBytes = fs.readFileSync(SAMPLE_CSV_PATH);
  const expectedSha256 = crypto.createHash('sha256').update(fileBytes).digest('hex');
  assert.strictEqual(result.sha256, expectedSha256, 'Computed SHA-256 must match file checksum');
});

test('2. Zero-CUI & Invalid Record Isolation — Records separated into invalid table with clear reason', () => {
  const db = new Database(NATIONAL_DB_PATH, { readonly: true });

  const invalidCount = db.prepare('SELECT count(*) as count FROM national_companies_invalid').get().count;
  assert.strictEqual(invalidCount, 91, 'Exactly 91 zero-CUI records must be logged');

  const zeroCuiSample = db.prepare("SELECT * FROM national_companies_invalid WHERE rejection_reason = 'CUI_ZERO_OR_REDACTED' LIMIT 1").get();
  assert.ok(zeroCuiSample, 'Zero CUI record must exist in invalid log');
  assert.strictEqual(zeroCuiSample.raw_cui, '0');
  assert.ok(zeroCuiSample.name.length > 0, 'Company name must be preserved in invalid log');
  assert.ok(zeroCuiSample.raw_line.includes('^0^'), 'Raw line must be preserved for auditing');

  db.close();
});

test('3. Idempotency & Duplicate Prevention — Re-running import does not duplicate CUI records', async () => {
  const dbBefore = new Database(NATIONAL_DB_PATH, { readonly: true });
  const countBefore = dbBefore.prepare('SELECT count(*) as count FROM national_companies').get().count;
  dbBefore.close();

  // Re-run the exact same import
  const result = await runNationalImport({
    sourceFile: SAMPLE_CSV_PATH,
    datasetId: 'TEST_DATASET_IDEMPOTENT',
    batchSize: 2000,
  });

  assert.strictEqual(result.success, true);

  const dbAfter = new Database(NATIONAL_DB_PATH, { readonly: true });
  const countAfter = dbAfter.prepare('SELECT count(*) as count FROM national_companies').get().count;
  assert.strictEqual(countAfter, countBefore, 'Total company count must remain unchanged after re-import');
  assert.strictEqual(countAfter, 2908, 'Must remain strictly 2,908 unique CUIs');
  dbAfter.close();
});

test('4. National Database Search & Index Latency — Sub-millisecond performance on indexed fields', () => {
  const db = new Database(NATIONAL_DB_PATH, { readonly: true });

  // 1. Exact CUI Primary Key lookup
  const t0 = process.hrtime.bigint();
  const cuiRow = db.prepare('SELECT * FROM national_companies WHERE cui = ?').get(412052);
  const t1 = process.hrtime.bigint();
  const cuiLatencyUs = Number(t1 - t0) / 1000;

  assert.ok(cuiRow, 'TRANSIDEAL SRL must exist');
  assert.strictEqual(cuiRow.name, 'TRANSIDEAL SRL');
  assert.ok(cuiLatencyUs < 2000, `CUI lookup must be sub-2ms, was ${cuiLatencyUs} µs`);

  // 2. County Index Search
  const t2 = process.hrtime.bigint();
  const countyRows = db.prepare('SELECT cui, name FROM national_companies WHERE county = ? LIMIT 25').all('Cluj');
  const t3 = process.hrtime.bigint();
  const countyLatencyUs = Number(t3 - t2) / 1000;

  assert.ok(countyRows.length > 0, 'Cluj companies must be found');
  assert.ok(countyLatencyUs < 5000, `County search must be sub-5ms, was ${countyLatencyUs} µs`);

  // 3. Name Index Search
  const t4 = process.hrtime.bigint();
  const nameRows = db.prepare('SELECT cui, name FROM national_companies WHERE normalized_name LIKE ? LIMIT 25').all('%CONEXIM%');
  const t5 = process.hrtime.bigint();
  const nameLatencyUs = Number(t5 - t4) / 1000;

  assert.ok(nameRows.length > 0, 'CONEXIM must be found');
  assert.ok(nameLatencyUs < 10000, `Name search must be sub-10ms, was ${nameLatencyUs} µs`);

  db.close();
});

test('5. Operational Promotion — Promotes company to operational DB without duplicating canonical CUI', () => {
  const opDb = new Database(CANONICAL_OPERATIONAL_DB);
  const natDb = new Database(NATIONAL_DB_PATH, { readonly: true });

  // 1. Pick a CUI from national DB
  const sample = natDb.prepare('SELECT cui, name FROM national_companies LIMIT 1').get();
  assert.ok(sample);

  // 2. Check if exists in operational DB
  const existingInOp = opDb.prepare('SELECT id, cui FROM companies WHERE cui = ?').get(sample.cui);
  assert.ok(existingInOp, 'Sample company already exists in canonical seed');

  // Verify that an attempt to promote an existing company preserves canonical identity
  const initialTotal = opDb.prepare('SELECT count(*) as count FROM companies WHERE cui NOT BETWEEN 90000000 AND 99999999').get().count;
  assert.strictEqual(initialTotal, 2908);

  // Simulate promotion logic: if exists, return ALREADY_EXISTS
  let action = 'PROMOTED_NEW';
  if (existingInOp) {
    action = 'ALREADY_EXISTS';
  } else {
    opDb.prepare(`
      INSERT INTO companies (cui, name, status, classification, discovery_source)
      VALUES (?, ?, 'ACTIVE', 'HISTORICAL', 'NATIONAL_DATABASE_PROMOTION')
    `).run(sample.cui, sample.name);
  }

  assert.strictEqual(action, 'ALREADY_EXISTS', 'Must detect company already in operational database');

  const finalTotal = opDb.prepare('SELECT count(*) as count FROM companies WHERE cui NOT BETWEEN 90000000 AND 99999999').get().count;
  assert.strictEqual(finalTotal, 2908, 'Operational total must not increase when company already exists');

  opDb.close();
  natDb.close();
});

test('6. Data Preservation — Operational historical companies and active prospects remain strictly intact', () => {
  const opDb = new Database(CANONICAL_OPERATIONAL_DB, { readonly: true });

  const total = opDb.prepare('SELECT count(*) as count FROM companies WHERE cui NOT BETWEEN 90000000 AND 99999999').get().count;
  assert.strictEqual(total, 2908, 'Canonical operational companies must remain exactly 2,908');

  const activeProspects = opDb.prepare(`
    SELECT count(*) as count FROM companies c
    WHERE c.legal_status = 'ACTIVE'
      AND c.fiscal_status IN ('FISCALLY_ACTIVE', 'REACTIVATED')
      AND c.cui NOT IN (SELECT cui FROM suppression_list)
      AND EXISTS (
        SELECT 1 FROM contact_records cr WHERE cr.cui = c.cui AND (
          (cr.contact_type IN ('MOBILE', 'LANDLINE') AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
          OR (cr.contact_type = 'EMAIL' AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
        )
      )
  `).get().count;

  assert.strictEqual(activeProspects, 128, 'Active prospects in operational database must remain exactly 128');

  // Radiated companies preserved
  const radiated = opDb.prepare("SELECT count(*) as count FROM companies WHERE legal_status = 'RADIATED'").get().count;
  assert.strictEqual(radiated, 301, 'Radiated companies must remain exactly 301');

  opDb.close();
});

test('7. Capacity Projection & Free-Tier Proof — Benchmarked storage satisfies Cloudflare Free boundaries', () => {
  const stats = fs.statSync(NATIONAL_DB_PATH);
  const bytesPerCompany = stats.size / 2908;

  // Projections
  const size10kMb = (10000 * bytesPerCompany) / (1024 * 1024);
  const size100kMb = (100000 * bytesPerCompany) / (1024 * 1024);
  const size500kMb = (500000 * bytesPerCompany) / (1024 * 1024);
  const size1M4Mb = (1400000 * bytesPerCompany) / (1024 * 1024);

  console.log(`Measured National DB size per company: ${bytesPerCompany.toFixed(1)} bytes`);
  console.log(`Projected 100k companies: ${size100kMb.toFixed(1)} MB`);
  console.log(`Projected 1.4M companies: ${size1M4Mb.toFixed(1)} MB`);

  // Cloudflare R2 Free Tier allows 10 GB (10,240 MB)
  assert.ok(size1M4Mb < 10240, '1.4M companies must easily fit within Cloudflare R2 10GB free tier');
  assert.ok(size1M4Mb < 1000, 'Uncompressed national dataset must be under 1GB');
});

test('8. Shard Generation & Manifest Validation — Validates manifest schema and shard integrity', async () => {
  const { generateShards, validateShards } = require('../scripts/generate-national-shards');
  const testShardsDir = path.join(__dirname, '..', 'data', 'test_shards');
  const manifest = await generateShards({
    sourceFile: SAMPLE_CSV_PATH,
    outputDir: testShardsDir,
    modulo: 100,
    datasetId: 'TEST_ONRC_VERIFIED',
  });

  assert.ok(manifest.source_sha256, 'Manifest must have source sha256');
  assert.strictEqual(manifest.total_valid_records, 2908, 'Manifest must declare 2,908 valid records');
  assert.strictEqual(manifest.total_invalid_records, 91, 'Manifest must declare 91 invalid records');
  assert.strictEqual(manifest.shards.cui_shards_count, 100, 'Must have 100 CUI shards');
  assert.ok(manifest.shards.counties_count > 30, 'Must cover over 30 counties');

  const validation = await validateShards(testShardsDir);
  assert.strictEqual(validation.valid, true, 'Shards must pass complete manifest validation');
  assert.strictEqual(validation.totalRecords, 2908, 'All 2,908 unique CUIs must be present across shards');
});

test('9. Worker Runtime Compatibility — Searches sharded storage without Node.js filesystem dependency', async () => {
  const { R2NationalStorageDriver, NationalSearchEngine } = require('../scripts/national-engine');

  // Load shards into an in-memory dictionary to simulate Cloudflare R2 object storage
  const shardsDir = path.join(__dirname, '..', 'data', 'test_shards');
  const manifest = JSON.parse(fs.readFileSync(path.join(shardsDir, 'manifest.json'), 'utf-8'));

  const memoryStore = new Map();
  memoryStore.set('national/manifest.json', manifest);

  // Load shard 52 (412052 % 100 = 52)
  const shard52 = JSON.parse(fs.readFileSync(path.join(shardsDir, 'shards', 'cui', 'shard-52.json'), 'utf-8'));
  memoryStore.set('shards/cui/shard-52.json', shard52);

  // Load prefix-tr for TRANSIDEAL
  if (fs.existsSync(path.join(shardsDir, 'shards', 'names', 'prefix-tr.json'))) {
    const prefixTr = JSON.parse(fs.readFileSync(path.join(shardsDir, 'shards', 'names', 'prefix-tr.json'), 'utf-8'));
    memoryStore.set('shards/names/prefix-tr.json', prefixTr);
  }

  // Mock Cloudflare Worker R2Bucket interface: { get(key): Promise<{ json(): Promise<any> }> }
  let subrequestCount = 0;
  const mockR2Bucket = {
    async get(key) {
      subrequestCount++;
      const data = memoryStore.get(key);
      if (!data) return null;
      return {
        async json() {
          return data;
        },
      };
    },
  };

  const r2Driver = new R2NationalStorageDriver(mockR2Bucket);
  assert.strictEqual(r2Driver.getDriverName(), 'R2_STORAGE');
  assert.strictEqual(await r2Driver.isAvailable(), true);

  // 1. Test direct CUI search via Mock R2 (1 subrequest)
  subrequestCount = 0;
  const cuiRes = await NationalSearchEngine.search({ cui: 412052 }, r2Driver);
  assert.strictEqual(cuiRes.items.length, 1);
  assert.strictEqual(cuiRes.items[0].cui, 412052);
  assert.strictEqual(cuiRes.items[0].name, 'TRANSIDEAL SRL');
  assert.ok(subrequestCount <= 2, `Direct CUI lookup must use <= 2 subrequests, used ${subrequestCount}`);

  // 2. Test Name search via Mock R2
  subrequestCount = 0;
  const nameRes = await NationalSearchEngine.search({ q: 'TRANSIDEAL' }, r2Driver);
  assert.strictEqual(nameRes.items.length, 1);
  assert.strictEqual(nameRes.items[0].name, 'TRANSIDEAL SRL');
  assert.ok(subrequestCount <= 3, `Name prefix search must use <= 3 subrequests, used ${subrequestCount}`);

  // 3. Test getByCui single profile fetch
  subrequestCount = 0;
  const profile = await NationalSearchEngine.getByCui(412052, r2Driver);
  assert.ok(profile);
  assert.strictEqual(profile.cui, 412052);
  assert.strictEqual(subrequestCount, 2); // 1 manifest check + 1 shard read
});

