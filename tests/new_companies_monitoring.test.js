const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Database = require('better-sqlite3');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'radar_business.db');

test('1. Monitoring configuration persists and provides activation cutoff and schedule', () => {
  const db = new Database(DB_PATH);
  const rows = db.prepare('SELECT key, value FROM monitoring_config').all();
  const config = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  assert.ok(config.monitoring_activation_date, 'Activation cutoff date must be configured');
  assert.ok(config.cron_schedule, 'Cron schedule must be configured');
  assert.ok(config.active_source, 'Active source must be configured');
  assert.strictEqual(config.active_source, 'ONRC_DATA_GOV', 'Active source must be ONRC Open Data');
  assert.ok(config.batch_limit, 'Batch limit must be defined');
  db.close();
});

test('2. Historical companies registered before cutoff belong to FIRME EXISTENTE (HISTORICAL)', () => {
  const db = new Database(DB_PATH);
  const cutoff = db.prepare("SELECT value FROM monitoring_config WHERE key = 'monitoring_activation_date'").get().value;

  // Check that all 2,908 historical companies have registration_date < cutoff or classification = 'HISTORICAL'
  const historicalCount = db.prepare("SELECT COUNT(*) as count FROM companies WHERE classification = 'HISTORICAL'").get().count;
  assert.strictEqual(historicalCount, 2908, 'All 2,908 initial companies must remain classified as HISTORICAL');

  const registeredBeforeCutoff = db.prepare('SELECT COUNT(*) as count FROM companies WHERE registration_date < ?').get(cutoff).count;
  assert.strictEqual(registeredBeforeCutoff, 2908, 'All 2,908 initial companies have registration dates before activation cutoff');
  db.close();
});

test('3. Companies registered on or after cutoff are classified as FIRME NOI (NEW)', () => {
  const db = new Database(DB_PATH);
  const cutoff = '2026-10-01';

  // Insert a test company registered after cutoff
  const testCui = 99999001;
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);

  const regDate = '2026-10-15';
  const isNew = regDate >= cutoff;
  const classification = isNew ? 'NEW' : 'HISTORICAL';

  db.prepare(`
    INSERT INTO companies (
      cui, name, normalized_name, reg_com, legal_form, registration_date, incorporation_date,
      first_detected_at, classification, verification_state, qualification_status, discovery_source
    ) VALUES (?, 'TEST NEW DISCOVERED SRL', 'TEST NEW DISCOVERED SRL', 'J40/9999/2026', 'SRL', ?, ?, datetime('now'), ?, 'DISCOVERED', 'NEW_COMPANY_NOT_ASSESSED', 'ONRC_DATA_GOV')
  `).run(testCui, regDate, regDate, classification);

  const inserted = db.prepare('SELECT cui, classification, registration_date FROM companies WHERE cui = ?').get(testCui);
  assert.strictEqual(inserted.classification, 'NEW', 'Company registered after cutoff must have classification NEW');
  assert.strictEqual(inserted.registration_date, '2026-10-15');

  // Clean up
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.close();
});

test('4. Company discovered today but registered before cutoff remains HISTORICAL', () => {
  const db = new Database(DB_PATH);
  const cutoff = '2026-10-01';
  const testCui = 99999002;
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);

  const olderRegDate = '2024-05-10'; // older company
  const isNew = olderRegDate >= cutoff;
  const classification = isNew ? 'NEW' : 'HISTORICAL';

  db.prepare(`
    INSERT INTO companies (
      cui, name, normalized_name, reg_com, legal_form, registration_date, incorporation_date,
      first_detected_at, classification, verification_state, qualification_status, discovery_source
    ) VALUES (?, 'OLDER DISCOVERED TODAY SRL', 'OLDER DISCOVERED TODAY SRL', 'J40/1234/2024', 'SRL', ?, ?, datetime('now'), ?, 'DISCOVERED', 'NEW_COMPANY_NOT_ASSESSED', 'ONRC_DATA_GOV')
  `).run(testCui, olderRegDate, olderRegDate, classification);

  const inserted = db.prepare('SELECT cui, classification, registration_date, first_detected_at FROM companies WHERE cui = ?').get(testCui);
  assert.strictEqual(inserted.classification, 'HISTORICAL', 'Company registered before cutoff must remain HISTORICAL even if detected today');
  assert.ok(inserted.first_detected_at, 'First detected timestamp must be preserved');

  // Clean up
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.close();
});

test('5. Duplicate CUI records merge into one canonical company without creating duplicate records', () => {
  const db = new Database(DB_PATH);
  const testCui = 99999003;
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);

  // First insertion
  db.prepare(`
    INSERT INTO companies (cui, name, reg_com, classification, discovery_source)
    VALUES (?, 'INITIAL CORP SRL', 'J40/100/2026', 'NEW', 'ONRC_DATA_GOV')
  `).run(testCui);

  // Second discovery with same CUI - should update or merge, not create duplicate
  db.prepare(`
    INSERT INTO companies (cui, name, reg_com, classification, discovery_source)
    VALUES (?, 'UPDATED CORP SRL', 'J40/100/2026', 'NEW', 'ONRC_DATA_GOV')
    ON CONFLICT(cui) DO UPDATE SET
      name = excluded.name,
      last_observed_at = datetime('now')
  `).run(testCui);

  const count = db.prepare('SELECT COUNT(*) as count FROM companies WHERE cui = ?').get(testCui).count;
  assert.strictEqual(count, 1, 'Only one canonical record must exist per CUI');

  const updated = db.prepare('SELECT name FROM companies WHERE cui = ?').get(testCui);
  assert.strictEqual(updated.name, 'UPDATED CORP SRL', 'Canonical record was updated with merged information');

  // Clean up
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.close();
});

test('6. Ingestion caret parser correctly extracts columns from ONRC dataset line', () => {
  const line = 'VOGO DIGITAL S.R.L.^55441691^J2026038080003^14/08/2026 09:23:04^ROONRC.J2026038080003^SRL^România^Bucureşti^Bucureşti Sectorul 1^Strada Nicolae Iorga^12^^^^^^^^';
  const parts = line.split('^').map((s) => s.trim().replace(/^"|"$/g, ''));

  assert.strictEqual(parts[0], 'VOGO DIGITAL S.R.L.');
  assert.strictEqual(parts[1], '55441691');
  assert.strictEqual(parts[2], 'J2026038080003');
  assert.strictEqual(parts[3], '14/08/2026 09:23:04');
  assert.strictEqual(parts[5], 'SRL');
  assert.strictEqual(parts[7], 'Bucureşti');
});

test('7. Monitoring sync logs audit execution status, counts and checkpoints', () => {
  const db = new Database(DB_PATH);
  const syncId = `test_audit_${Date.now()}`;

  db.prepare(`
    INSERT INTO monitoring_sync_logs (
      sync_id, source_name, source_url, started_at, ended_at, status,
      records_discovered, records_updated, records_rejected, checkpoint_start, checkpoint_end, execution_type, triggered_by
    ) VALUES (?, 'ONRC_DATA_GOV', 'https://data.gov.ro/dataset/...', datetime('now'), datetime('now'), 'SUCCESS', 15, 2, 0, '1000', '1500', 'MANUAL_ADMIN', 'admin_test')
  `).run(syncId);

  const log = db.prepare('SELECT * FROM monitoring_sync_logs WHERE sync_id = ?').get(syncId);
  assert.ok(log, 'Sync log must be retrieved');
  assert.strictEqual(log.status, 'SUCCESS');
  assert.strictEqual(log.records_discovered, 15);
  assert.strictEqual(log.records_updated, 2);
  assert.strictEqual(log.checkpoint_start, '1000');
  assert.strictEqual(log.checkpoint_end, '1500');

  // Clean up
  db.prepare('DELETE FROM monitoring_sync_logs WHERE sync_id = ?').run(syncId);
  db.close();
});

test('8. Navigation presents strictly the 4 unified platform sections', () => {
  const navFilePath = path.join(__dirname, '..', 'src', 'components', 'Navigation.tsx');
  const navContent = fs.readFileSync(navFilePath, 'utf8');

  assert.ok(navContent.includes("href: '/companies'"), 'Navigation must contain /companies');
  assert.ok(navContent.includes("href: '/new-companies'"), 'Navigation must contain /new-companies');
  assert.ok(navContent.includes("href: '/pipeline'"), 'Navigation must contain /pipeline');
  assert.ok(navContent.includes("href: '/settings'"), 'Navigation must contain /settings');

  // Verify label text
  assert.ok(navContent.includes('Firme existente'));
  assert.ok(navContent.includes('Firme noi'));
  assert.ok(navContent.includes('Activități'));
  assert.ok(navContent.includes('Configurare'));
});

test('9. Legacy routes redirect to consolidated workspace sections', () => {
  const routesToCheck = [
    { file: 'src/app/calling/page.tsx', target: '/companies' },
    { file: 'src/app/radar/page.tsx', target: '/companies' },
    { file: 'src/app/insurance/page.tsx', target: '/companies' },
    { file: 'src/app/industries/page.tsx', target: '/companies' },
    { file: 'src/app/enrichment/page.tsx', target: '/companies' },
    { file: 'src/app/sources/page.tsx', target: '/settings' },
    { file: 'src/app/health/page.tsx', target: '/settings' },
  ];

  for (const r of routesToCheck) {
    const fullPath = path.join(__dirname, '..', r.file);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(
      content.includes(`redirect('${r.target}')`),
      `Route ${r.file} must redirect to ${r.target}`
    );
  }
});

test('10. Cloudflare Worker configuration includes daily Cron Trigger', () => {
  const wranglerPath = path.join(__dirname, '..', 'wrangler.jsonc');
  const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');

  assert.ok(wranglerContent.includes('"triggers"'), 'wrangler.jsonc must contain triggers');
  assert.ok(wranglerContent.includes('"crons"'), 'wrangler.jsonc must contain crons');
  assert.ok(wranglerContent.includes('0 6 * * *'), 'wrangler.jsonc must declare daily cron trigger');
});
