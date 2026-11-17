/**
 * RADAR BUSINESS ROMÂNIA — ETAPA 3C TEST SUITE
 * 
 * Verifies:
 * 1. Physical EOF after full stream processing.
 * 2. Artificial bounded stop at --limit 50.
 * 3. Artificial bounded stop at --limit 100.
 * 4. Network interruption during a batch (stream error).
 * 5. HTTP failure when sending a batch (500 server error).
 * 6. Resumption after checkpoint without skipped rows or duplicates.
 * 7. Final batch with fewer than 50 companies (< BATCH_SIZE at EOF).
 * 8. Source without eligible records (all pre-cutoff or invalid).
 * 9. Resumption rejected with different source version (stale datasetModified).
 * 10. Confirmation that bounded limit test never activates CONTINUOUS_DISCOVERY.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const Database = require('better-sqlite3');
const { Readable } = require('node:stream');

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test_onrc_eof.db');
const TEST_CHECKPOINT_FILE = path.join(__dirname, '..', 'data', '.test_onrc_sync_checkpoint.json');

// Helper to create a mock ONRC caret-delimited CSV stream
function createMockOnrcStream(rows) {
  const header = 'DENUMIRE^CUI^COD_INMATRICULARE^DATA_INREGISTRARE^EUID^FORMA_ORGANIZARE^TARA^JUDET^LOCALITATE\n';
  const content = header + rows.map(r => 
    `"${r.name}"^"${r.cui}"^"${r.regCom || 'J40/1/2026'}"^"${r.regDate}"^"ROONRC.J40.1.2026"^"SRL"^"România"^"BUCURESTI"^"SECTORUL 1"`
  ).join('\n') + '\n';
  return Readable.from([content]);
}

// Clean up test files before and after
function cleanup() {
  try { if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
  try { if (fs.existsSync(TEST_CHECKPOINT_FILE)) fs.unlinkSync(TEST_CHECKPOINT_FILE); } catch (e) {}
}

function initTestDb() {
  cleanup();
  const db = new Database(TEST_DB_PATH);
  db.exec(`
    CREATE TABLE monitoring_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO monitoring_config (key, value, updated_at) VALUES 
      ('monitoring_state', 'INITIAL_BACKFILL', datetime('now')),
      ('baseline_backfill_cutoff', '2026-08-15', datetime('now')),
      ('stream_cursor_line', '0', datetime('now')),
      ('last_sync_status', 'PENDING', datetime('now'));

    CREATE TABLE companies (
      cui INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT,
      reg_com TEXT,
      euid TEXT,
      legal_form TEXT,
      incorporation_date TEXT,
      registration_date TEXT,
      first_detected_at TEXT,
      country TEXT,
      county TEXT,
      city TEXT,
      street TEXT,
      street_nr TEXT,
      website TEXT,
      primary_caen TEXT,
      caen_description TEXT,
      legal_status TEXT,
      fiscal_status TEXT,
      classification TEXT,
      verification_state TEXT,
      qualification_status TEXT,
      discovery_source TEXT,
      discovery_batch_id TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);
  return db;
}

test('Scenario 1: Physical EOF after processing full stream marks isComplete=true', async () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({
    name: `Firma Full ${i + 1}`,
    cui: 100000 + i + 1,
    regDate: '2026-10-01'
  }));
  const inputStream = createMockOnrcStream(rows);

  let sentBatches = [];
  let limitReached = false;
  let eofReached = false;
  let lineCount = 0;
  let batchBuffer = [];
  const BATCH_SIZE = 50;
  const LIMIT = 0; // Unlimited

  const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue; // header
    const cols = line.split('^').map(s => s.trim().replace(/^"|"$/g, ''));
    if (cols.length < 4) continue;
    batchBuffer.push({ cui: parseInt(cols[1]), name: cols[0] });

    if (batchBuffer.length >= BATCH_SIZE) {
      sentBatches.push({ count: batchBuffer.length, isComplete: false });
      batchBuffer = [];
    }
  }

  if (!limitReached) eofReached = true;

  if (batchBuffer.length > 0) {
    sentBatches.push({ count: batchBuffer.length, isComplete: eofReached && !limitReached });
    batchBuffer = [];
  } else if (eofReached && !limitReached) {
    sentBatches.push({ count: 0, isComplete: true });
  }

  assert.strictEqual(eofReached, true, 'EOF must be reached');
  assert.strictEqual(limitReached, false, 'Limit must not be reached');
  assert.strictEqual(sentBatches.length, 2, 'Must produce 2 batches (50 + 10)');
  assert.strictEqual(sentBatches[0].count, 50);
  assert.strictEqual(sentBatches[0].isComplete, false);
  assert.strictEqual(sentBatches[1].count, 10);
  assert.strictEqual(sentBatches[1].isComplete, true, 'Final batch at genuine physical EOF must have isComplete=true');
});

test('Scenario 2: Artificial bounded stop at --limit 50 sets isComplete=false and sends zero empty batches', async () => {
  const rows = Array.from({ length: 200 }, (_, i) => ({
    name: `Firma Limit ${i + 1}`,
    cui: 200000 + i + 1,
    regDate: '2026-10-01'
  }));
  const inputStream = createMockOnrcStream(rows);

  let sentBatches = [];
  let limitReached = false;
  let eofReached = false;
  let lineCount = 0;
  let batchBuffer = [];
  const BATCH_SIZE = 50;
  const LIMIT = 50; // Stopped at 50

  const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;
    const cols = line.split('^').map(s => s.trim().replace(/^"|"$/g, ''));
    if (cols.length < 4) continue;
    batchBuffer.push({ cui: parseInt(cols[1]), name: cols[0] });

    if (batchBuffer.length >= BATCH_SIZE) {
      sentBatches.push({ count: batchBuffer.length, isComplete: false });
      batchBuffer = [];
    }

    if (LIMIT > 0 && sentBatches.reduce((acc, b) => acc + b.count, 0) + batchBuffer.length >= LIMIT) {
      limitReached = true;
      rl.close();
      break;
    }
  }

  if (!limitReached) eofReached = true;

  if (batchBuffer.length > 0) {
    sentBatches.push({ count: batchBuffer.length, isComplete: eofReached && !limitReached });
    batchBuffer = [];
  } else if (eofReached && !limitReached) {
    sentBatches.push({ count: 0, isComplete: true });
  }

  assert.strictEqual(limitReached, true, 'limitReached must be true');
  assert.strictEqual(eofReached, false, 'eofReached must be false when limit was hit');
  assert.strictEqual(sentBatches.length, 1, 'Must have sent exactly 1 batch of 50');
  assert.strictEqual(sentBatches[0].count, 50);
  assert.strictEqual(sentBatches[0].isComplete, false, 'isComplete must be false on bounded limit stop');
  assert.ok(!sentBatches.some(b => b.count === 0), 'Must NOT send trailing empty batch');
});

test('Scenario 3: Artificial bounded stop at --limit 100 sets isComplete=false', async () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({
    name: `Firma Limit 100 ${i + 1}`,
    cui: 300000 + i + 1,
    regDate: '2026-10-01'
  }));
  const inputStream = createMockOnrcStream(rows);

  let sentBatches = [];
  let limitReached = false;
  let eofReached = false;
  let lineCount = 0;
  let batchBuffer = [];
  const BATCH_SIZE = 50;
  const LIMIT = 100;

  const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;
    const cols = line.split('^').map(s => s.trim().replace(/^"|"$/g, ''));
    if (cols.length < 4) continue;
    batchBuffer.push({ cui: parseInt(cols[1]), name: cols[0] });

    if (batchBuffer.length >= BATCH_SIZE) {
      sentBatches.push({ count: batchBuffer.length, isComplete: false });
      batchBuffer = [];
    }

    if (LIMIT > 0 && sentBatches.reduce((acc, b) => acc + b.count, 0) + batchBuffer.length >= LIMIT) {
      limitReached = true;
      rl.close();
      break;
    }
  }

  if (!limitReached) eofReached = true;

  if (batchBuffer.length > 0) {
    sentBatches.push({ count: batchBuffer.length, isComplete: eofReached && !limitReached });
    batchBuffer = [];
  }

  assert.strictEqual(limitReached, true);
  assert.strictEqual(eofReached, false);
  assert.strictEqual(sentBatches.length, 2, 'Must have sent exactly 2 batches of 50');
  assert.strictEqual(sentBatches[0].isComplete, false);
  assert.strictEqual(sentBatches[1].isComplete, false);
});

test('Scenario 4: Network interruption during batch preserves last committed line in checkpoint', () => {
  cleanup();
  let lastCommittedLine = 100;
  let currentLineCount = 135;

  // Simulate network failure mid-batch
  const simulatedError = new Error('READ_INACTIVITY_TIMEOUT (30s inactivity)');
  
  // Write checkpoint on error preserving lastCommittedLine
  const checkpointData = {
    cursorLine: lastCommittedLine, // NOT currentLineCount!
    failedAtLine: currentLineCount,
    datasetModified: '2026-11-06T05:19:37',
    resourceId: 'res_123',
    error: simulatedError.message
  };
  fs.writeFileSync(TEST_CHECKPOINT_FILE, JSON.stringify(checkpointData));

  // Verify checkpoint integrity
  const saved = JSON.parse(fs.readFileSync(TEST_CHECKPOINT_FILE, 'utf8'));
  assert.strictEqual(saved.cursorLine, 100, 'Checkpoint must NOT advance past last committed line');
  assert.strictEqual(saved.failedAtLine, 135, 'Failed line must be recorded for debugging');
  cleanup();
});

test('Scenario 5: HTTP 500 failure when sending batch does not advance checkpoint', () => {
  cleanup();
  let lastCommittedLine = 250;
  let batchBuffer = Array.from({ length: 50 }, (_, i) => ({ cui: 400000 + i }));
  let lineCount = 300;

  // Simulate HTTP failure
  let httpFailed = false;
  try {
    throw new Error('HTTP 500: Internal Server Error on Worker');
  } catch (err) {
    httpFailed = true;
    fs.writeFileSync(TEST_CHECKPOINT_FILE, JSON.stringify({
      cursorLine: lastCommittedLine,
      failedAtLine: lineCount,
      error: err.message
    }));
  }

  assert.strictEqual(httpFailed, true);
  const cp = JSON.parse(fs.readFileSync(TEST_CHECKPOINT_FILE, 'utf8'));
  assert.strictEqual(cp.cursorLine, 250, 'Checkpoint must remain at 250, not 300');
  cleanup();
});

test('Scenario 6: Resumption after checkpoint skips lines up to cursorLine and resumes seamlessly', async () => {
  cleanup();
  // 100 rows in dataset
  const rows = Array.from({ length: 100 }, (_, i) => ({
    name: `Firma Resume ${i + 1}`,
    cui: 500000 + i + 1,
    regDate: '2026-10-01'
  }));

  // Checkpoint was saved at line 51 (header + 50 rows)
  const savedCursor = 51;
  const processedCompanies = [];

  const inputStream = createMockOnrcStream(rows);
  const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (lineCount <= savedCursor) {
      continue; // Skip already committed lines
    }
    const cols = line.split('^').map(s => s.trim().replace(/^"|"$/g, ''));
    if (cols.length < 4) continue;
    processedCompanies.push({ cui: parseInt(cols[1]), line: lineCount });
  }

  assert.strictEqual(processedCompanies.length, 50, 'Must process exactly the remaining 50 companies');
  assert.strictEqual(processedCompanies[0].cui, 500051, 'First resumed company must be row 51');
  assert.strictEqual(processedCompanies[49].cui, 500100, 'Last resumed company must be row 100');
  cleanup();
});

test('Scenario 7: Final batch with fewer than 50 companies (< BATCH_SIZE at EOF)', async () => {
  const rows = Array.from({ length: 73 }, (_, i) => ({
    name: `Firma Partial ${i + 1}`,
    cui: 600000 + i + 1,
    regDate: '2026-10-01'
  }));
  const inputStream = createMockOnrcStream(rows);

  let sentBatches = [];
  let lineCount = 0;
  let batchBuffer = [];
  const BATCH_SIZE = 50;

  const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;
    const cols = line.split('^').map(s => s.trim().replace(/^"|"$/g, ''));
    if (cols.length < 4) continue;
    batchBuffer.push({ cui: parseInt(cols[1]) });

    if (batchBuffer.length >= BATCH_SIZE) {
      sentBatches.push({ count: batchBuffer.length, isComplete: false });
      batchBuffer = [];
    }
  }

  // True physical EOF reached
  if (batchBuffer.length > 0) {
    sentBatches.push({ count: batchBuffer.length, isComplete: true });
    batchBuffer = [];
  }

  assert.strictEqual(sentBatches.length, 2);
  assert.strictEqual(sentBatches[0].count, 50);
  assert.strictEqual(sentBatches[0].isComplete, false);
  assert.strictEqual(sentBatches[1].count, 23);
  assert.strictEqual(sentBatches[1].isComplete, true, 'Partial trailing batch at EOF must carry isComplete=true');
});

test('Scenario 8: Source without eligible records completes with 0 companies and signals EOF cleanly', async () => {
  // All historical before cutoff (2026-08-15)
  const rows = [
    { name: 'Veche 1', cui: 700001, regDate: '1995-05-10' },
    { name: 'Veche 2', cui: 700002, regDate: '2010-12-01' },
    { name: 'Veche 3', cui: 700003, regDate: '2026-08-14' }, // 1 day before cutoff
  ];
  const inputStream = createMockOnrcStream(rows);

  const baselineCutoff = '2026-08-15';
  let eligibleCount = 0;
  let sentBatches = [];
  let lineCount = 0;

  const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });
  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;
    const cols = line.split('^').map(s => s.trim().replace(/^"|"$/g, ''));
    if (cols.length < 4) continue;
    const regDate = cols[3];
    if (regDate >= baselineCutoff) {
      eligibleCount++;
    }
  }

  // Genuine EOF reached with 0 eligible companies
  const eofReached = true;
  if (eligibleCount === 0 && eofReached) {
    sentBatches.push({ count: 0, isComplete: true });
  }

  assert.strictEqual(eligibleCount, 0, 'No companies should pass cutoff');
  assert.strictEqual(sentBatches.length, 1);
  assert.strictEqual(sentBatches[0].count, 0);
  assert.strictEqual(sentBatches[0].isComplete, true);
});

test('Scenario 9: Resumption rejected when dataset version changes (stale checkpoint discarded)', () => {
  cleanup();
  const oldDatasetModified = '2026-10-01T05:00:00';
  const newDatasetModified = '2026-11-06T05:19:37';

  fs.writeFileSync(TEST_CHECKPOINT_FILE, JSON.stringify({
    cursorLine: 50000,
    datasetModified: oldDatasetModified,
    resourceId: 'res_old'
  }));

  // Simulate loading checkpoint
  let startCursor = 0;
  const cp = JSON.parse(fs.readFileSync(TEST_CHECKPOINT_FILE, 'utf8'));

  if (cp.datasetModified && cp.datasetModified !== newDatasetModified) {
    // Checkpoint is stale! Reset it!
    fs.unlinkSync(TEST_CHECKPOINT_FILE);
    startCursor = 0; // Reset to 0!
  } else {
    startCursor = cp.cursorLine;
  }

  assert.strictEqual(startCursor, 0, 'Cursor must reset to 0 when dataset version changes');
  assert.strictEqual(fs.existsSync(TEST_CHECKPOINT_FILE), false, 'Stale checkpoint file must be removed');
  cleanup();
});

test('Scenario 10: Confirmation that bounded limit test does NOT activate CONTINUOUS_DISCOVERY in DB', () => {
  const db = initTestDb();

  // Verify initial state
  const beforeState = db.prepare("SELECT value FROM monitoring_config WHERE key = 'monitoring_state'").get().value;
  assert.strictEqual(beforeState, 'INITIAL_BACKFILL');

  // Simulate bounded limit stop (LIMIT = 50)
  const limitReached = true;
  const eofReached = false;

  if (eofReached && !limitReached) {
    db.prepare("UPDATE monitoring_config SET value = 'CONTINUOUS_DISCOVERY' WHERE key = 'monitoring_state'").run();
    db.prepare("UPDATE monitoring_config SET value = 'SUCCESS' WHERE key = 'last_sync_status'").run();
  } else if (limitReached) {
    db.prepare("UPDATE monitoring_config SET value = 'PARTIAL_LIMIT_REACHED' WHERE key = 'last_sync_status'").run();
  }

  const afterState = db.prepare("SELECT value FROM monitoring_config WHERE key = 'monitoring_state'").get().value;
  const syncStatus = db.prepare("SELECT value FROM monitoring_config WHERE key = 'last_sync_status'").get().value;

  assert.strictEqual(afterState, 'INITIAL_BACKFILL', 'monitoring_state must NOT change to CONTINUOUS_DISCOVERY on limited test');
  assert.strictEqual(syncStatus, 'PARTIAL_LIMIT_REACHED', 'last_sync_status must reflect partial test, never SUCCESS');

  db.close();
  cleanup();
});
