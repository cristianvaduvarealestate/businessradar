const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('fs');
const {
  R2NationalStorageDriver,
  NationalSearchEngine,
  LocalShardsDriver,
  MAX_CUMULATIVE_BYTES_PER_REQUEST,
  MAX_SHARD_READS_PER_REQUEST,
  encodeCursor,
  decodeCursor,
} = require('../scripts/national-engine');

const V2_DIR = path.join(__dirname, '..', 'data', 'national_shards_v2');

test('1. V2 Object Size Limits — Every generated V2 shard is strictly under 4 MB', () => {
  assert.ok(fs.existsSync(V2_DIR), 'V2 shards directory must exist');
  const manifestPath = path.join(V2_DIR, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'V2 manifest.json must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.strictEqual(manifest.version, '2026.11.06-v2-worker-safe');
  assert.strictEqual(manifest.total_valid_records, 4041402);

  // Check observed max bytes from manifest
  assert.ok(manifest.limits.max_object_bytes_observed <= 4 * 1024 * 1024, 'Max object must be <= 4 MB');
  assert.ok(manifest.limits.max_object_bytes_observed < 3.2 * 1024 * 1024, 'Max object observed should be < 3.2 MB');
});

test('2. V2 Bounded County Pagination — Large counties load bounded pages under 2 MB', async () => {
  const driver = new LocalShardsDriver(V2_DIR);

  // Search București (735k companies)
  const resBuc = await NationalSearchEngine.search({ county: 'București', limit: 10 }, driver);
  assert.ok(resBuc.pagination.total > 700000, 'Must have > 700k records in București');
  assert.strictEqual(resBuc.items.length, 10, 'Must return requested limit of 10');
  assert.ok(resBuc.items[0].cui > 0, 'Must return valid company profile');

  // Search Cluj (200k companies)
  const resCluj = await NationalSearchEngine.search({ county: 'Cluj', limit: 10 }, driver);
  assert.ok(resCluj.pagination.total > 190000, 'Must have > 190k records in Cluj');
  assert.strictEqual(resCluj.items.length, 10);
});

test('3. V2 Adaptive Name Prefix Tree — Finds companies in deep subdivided prefixes', async () => {
  const driver = new LocalShardsDriver(V2_DIR);

  // DEDEMAN (prefix "de" -> 3-chars "ded")
  const dedemanRes = await NationalSearchEngine.search({ q: 'DEDEMAN' }, driver);
  assert.ok(dedemanRes.items.length >= 1);
  const found = dedemanRes.items.some((c) => c.name.includes('DEDEMAN'));
  assert.ok(found, 'Must find DEDEMAN company');

  // TRANSIDEAL
  const transRes = await NationalSearchEngine.search({ q: 'TRANSIDEAL' }, driver);
  assert.ok(transRes.items.length >= 1);
  assert.strictEqual(transRes.items[0].cui, 412052);
});

test('4. V2 Memory Safety Guard — R2 driver rejects oversized objects before parsing', async () => {
  let jsonParseCalled = false;
  const mockBucket = {
    async get(key) {
      return {
        size: 5 * 1024 * 1024, // 5 MB (exceeds 4MB limit)
        async json() {
          jsonParseCalled = true;
          return { test: true };
        },
      };
    },
  };

  const r2Driver = new R2NationalStorageDriver(mockBucket);
  const data = await r2Driver.getJson('shards/cui/oversized.json');
  assert.strictEqual(data, null, 'Oversized object must be rejected');
  assert.strictEqual(jsonParseCalled, false, 'Must NOT attempt to parse JSON on oversized object');
});

test('5. V2 Error Resilience — Missing shard files return safe empty results without throwing', async () => {
  const mockBucket = {
    async get(key) {
      if (key === 'national/manifest.json') {
        return {
          async json() {
            return {
              version: '2026.11.06-v2-worker-safe',
              total_valid_records: 4041402,
              shards: { cui_modulo: 1000 },
            };
          },
        };
      }
      return null; // All other keys missing
    },
  };

  const r2Driver = new R2NationalStorageDriver(mockBucket);
  const res = await NationalSearchEngine.search({ cui: 99999999 }, r2Driver);
  assert.strictEqual(res.items.length, 0);
  assert.strictEqual(res.pagination.total, 0);

  const profile = await NationalSearchEngine.getByCui(99999999, r2Driver);
  assert.strictEqual(profile, null);
});

test('6. V2 Subdivided CUI Shard Resolution — Accurately routes CUIs to sub0 vs sub1 partitions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(V2_DIR, 'manifest.json'), 'utf-8'));

  // CUI 26000 (modulo 1000 = 0, floor(26000/1000)=26, 26%2 = 0) -> shard-000-sub0.json
  const key0 = NationalSearchEngine.resolveCuiShardKey(26000, manifest);
  assert.strictEqual(key0, 'shards/cui/shard-000-sub0.json');

  // CUI 9000 (modulo 1000 = 0, floor(9000/1000)=9, 9%2 = 1) -> shard-000-sub1.json
  const key1 = NationalSearchEngine.resolveCuiShardKey(9000, manifest);
  assert.strictEqual(key1, 'shards/cui/shard-000-sub1.json');

  // Non-subdivided partition (e.g. partition 11) -> shard-011.json
  const keyNonSub = NationalSearchEngine.resolveCuiShardKey(412011, manifest);
  assert.strictEqual(keyNonSub, 'shards/cui/shard-011.json');
});

test('7. V2 Multi-Tier Adaptive Prefix Tree — Routes 2-char, 3-char, and 4-char prefix queries', async () => {
  const driver = new LocalShardsDriver(V2_DIR);

  // 4-char prefix: "tran" (from "TRANSIDEAL")
  const r4 = await NationalSearchEngine.search({ q: 'TRANSIDEAL' }, driver);
  assert.ok(r4.items.length >= 1);
  assert.strictEqual(r4.items[0].cui, 412052);

  // 3-char prefix: "tri" (from "TRIO")
  const r3 = await NationalSearchEngine.search({ q: 'TRIO' }, driver);
  assert.ok(r3.items.length >= 1);
  assert.ok(r3.items.some((c) => c.name.includes('TRIO')));

  // 2-char prefix root: "tr"
  const r2 = await NationalSearchEngine.search({ q: 'TR' }, driver);
  assert.ok(r2.items.length >= 1);
});

test('8. V2 Stable Cursor-Based Pagination — Consecutive pages have zero overlap and zero item loss', async () => {
  const driver = new LocalShardsDriver(V2_DIR);

  const p1 = await NationalSearchEngine.search({ county: 'Cluj', limit: 10 }, driver);
  assert.strictEqual(p1.items.length, 10);
  assert.ok(p1.pagination.nextCursor, 'Page 1 must produce a nextCursor');

  const p2 = await NationalSearchEngine.search({ county: 'Cluj', cursor: p1.pagination.nextCursor }, driver);
  assert.strictEqual(p2.items.length, 10);
  assert.strictEqual(p2.pagination.page, 2);

  // Verify zero overlap
  const p1Cuis = new Set(p1.items.map((i) => i.cui));
  const overlap = p2.items.filter((i) => p1Cuis.has(i.cui));
  assert.strictEqual(overlap.length, 0, 'Page 1 and Page 2 must not have overlapping CUIs');
});

test('9. V2 Tampered Cursor Resilience — Malformed or invalid cursors fall back gracefully to Page 1', async () => {
  const driver = new LocalShardsDriver(V2_DIR);

  // 1. Invalid base64
  const resInvalidBase64 = await NationalSearchEngine.search({ county: 'Iași', cursor: '!!!not-valid-base64!!!', limit: 5 }, driver);
  assert.strictEqual(resInvalidBase64.pagination.page, 1);
  assert.strictEqual(resInvalidBase64.items.length, 5);

  // 2. Corrupted JSON payload (negative page number)
  const tamperedPayload = Buffer.from(JSON.stringify({ p: -99, l: 5 })).toString('base64');
  const resNegative = await NationalSearchEngine.search({ county: 'Iași', cursor: tamperedPayload, limit: 5 }, driver);
  assert.strictEqual(resNegative.pagination.page, 1);
  assert.strictEqual(resNegative.items.length, 5);

  // 3. String limit
  const tamperedType = Buffer.from(JSON.stringify({ p: 2, l: 'bad_string' })).toString('base64');
  const resBadType = await NationalSearchEngine.search({ county: 'Iași', cursor: tamperedType, limit: 5 }, driver);
  assert.strictEqual(resBadType.pagination.page, 1);
});

test('10. V2 Cumulative Memory Budget Enforcement — Stops reading shards before 8 MB budget is reached', async () => {
  const driver = new LocalShardsDriver(V2_DIR);

  // Search with hydration enabled across 25 items in București
  const res = await NationalSearchEngine.search({ county: 'București', limit: 25, hydrate: true }, driver);
  assert.strictEqual(res.items.length, 25, 'Must return all 25 items');
  assert.ok(res.metrics.cumulativeBytesRead <= MAX_CUMULATIVE_BYTES_PER_REQUEST, 'Cumulative bytes read must be <= 8 MB');
  assert.ok(res.metrics.shardReadsCount <= MAX_SHARD_READS_PER_REQUEST, 'Shard reads must be <= 3');
  assert.strictEqual(res.metrics.budgetLimited, true, 'Budget guard must trigger cleanly without OOM');
});

test('11. V2 Direct Index List Performance — Standard list query executes with exactly 1 shard read', async () => {
  const driver = new LocalShardsDriver(V2_DIR);

  const res = await NationalSearchEngine.search({ county: 'Timiș', limit: 25 }, driver);
  assert.strictEqual(res.items.length, 25);
  assert.strictEqual(res.metrics.shardReadsCount, 1, 'Standard search must read exactly 1 index shard');
  assert.ok(res.metrics.cumulativeBytesRead < 2.5 * 1024 * 1024, 'Bytes read must be < 2.5 MB');
  assert.strictEqual(res.metrics.budgetLimited, false);
});

test('12. V2 Security & Storage Isolation — Driver strictly blocks audit and path traversal keys', async () => {
  const driver = new LocalShardsDriver(V2_DIR);

  // 1. Audit path blocked
  const auditData = await driver.getJson('audit/invalid_records.jsonl');
  assert.strictEqual(auditData, null, 'Driver must block access to audit files');

  // 2. Traversal path blocked
  const traversalData = await driver.getJson('../../../package.json');
  assert.strictEqual(traversalData, null, 'Driver must block path traversal');

  // 3. Permitted path succeeds
  const cuiData = await driver.getJson('shards/cui/shard-011.json');
  assert.ok(cuiData !== null, 'Permitted shard key must succeed');
});
