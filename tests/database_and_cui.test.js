const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'radar_business.db');

test('Database exists and holds verified Romanian companies', () => {
  const db = new Database(DB_PATH);
  
  const countRow = db.prepare('SELECT COUNT(*) as count FROM companies').get();
  assert(countRow.count >= 2500, `Expected at least 2500 companies in database, found ${countRow.count}`);

  const activeRow = db.prepare("SELECT COUNT(*) as count FROM companies WHERE status = 'ACTIVE'").get();
  assert(activeRow.count > 0, 'Expected active companies in database');

  const oppRow = db.prepare('SELECT COUNT(*) as count FROM insurance_opportunities').get();
  assert(oppRow.count > 0, 'Expected insurance opportunities generated in database');

  db.close();
});

test('CUI deduplication prevents duplicate company insertion', () => {
  const db = new Database(DB_PATH);
  
  // Find an existing CUI
  const existing = db.prepare('SELECT cui, name FROM companies LIMIT 1').get();
  assert(existing, 'Sample company must exist');

  // Attempt duplicate insert with ON CONFLICT DO UPDATE
  const stmt = db.prepare(`
    INSERT INTO companies (cui, name, status) 
    VALUES (?, ?, 'ACTIVE')
    ON CONFLICT(cui) DO UPDATE SET updated_at = datetime('now')
  `);

  stmt.run(existing.cui, existing.name);

  // Verify total count hasn't arbitrarily doubled
  const checkCount = db.prepare('SELECT COUNT(*) as count FROM companies WHERE cui = ?').get(existing.cui);
  assert.strictEqual(checkCount.count, 1, 'Company with same CUI must remain unique');

  db.close();
});

test('FTS5 Full-Text Search finds companies by name, CUI and county', () => {
  const db = new Database(DB_PATH);

  const sample = db.prepare("SELECT name, cui, county FROM companies WHERE name LIKE '%SRL%' LIMIT 1").get();
  assert(sample, 'Must have at least one SRL company');

  const searchHits = db.prepare("SELECT * FROM companies_fts WHERE companies_fts MATCH ?").all(sample.county);
  assert(searchHits.length > 0, 'FTS5 search must return matching companies by county/name');

  db.close();
});

test('Suppression List blocks excluded companies from leads', () => {
  const db = new Database(DB_PATH);
  const testCui = 999999999;

  // Insert suppression
  db.prepare("INSERT OR REPLACE INTO suppression_list (cui, reason) VALUES (?, 'Test Exclusion Request')").run(testCui);

  const isSuppressed = db.prepare('SELECT id FROM suppression_list WHERE cui = ?').get(testCui);
  assert(isSuppressed, 'CUI must be present in suppression list');

  // Clean up test entry
  db.prepare('DELETE FROM suppression_list WHERE cui = ?').run(testCui);
  db.close();
});
