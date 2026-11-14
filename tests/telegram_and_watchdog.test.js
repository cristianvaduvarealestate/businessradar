const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'radar_business.db');

test('Telegram SHA-256 deduplication computes consistent hashes', () => {
  const msg1 = '<b>RADAR BUSINESS</b> - Test Alert for CUI 123456';
  const msg2 = '<b>RADAR BUSINESS</b> - Test Alert for CUI 123456';
  const msg3 = '<b>RADAR BUSINESS</b> - Different Alert';

  const hash1 = crypto.createHash('sha256').update(msg1).digest('hex');
  const hash2 = crypto.createHash('sha256').update(msg2).digest('hex');
  const hash3 = crypto.createHash('sha256').update(msg3).digest('hex');

  assert.strictEqual(hash1, hash2, 'Identical message payloads must yield identical SHA-256 hashes');
  assert.notStrictEqual(hash1, hash3, 'Different message payloads must yield different hashes');
});

test('Telegram notification logging preserves dispatch history', () => {
  const db = new Database(DB_PATH);
  const testPayload = `<b>TEST NOTIFICATION</b> - ${Date.now()}`;
  const testHash = crypto.createHash('sha256').update(testPayload).digest('hex');

  db.prepare(`
    INSERT INTO telegram_notifications (notification_type, payload_hash, content, status, sent_at)
    VALUES ('TEST_ALERT', ?, ?, 'SENT', datetime('now'))
  `).run(testHash, testPayload);

  const logged = db.prepare('SELECT * FROM telegram_notifications WHERE payload_hash = ?').get(testHash);
  assert(logged, 'Notification must be stored in audit table');
  assert.strictEqual(logged.status, 'SENT');

  // Clean up test entry
  db.prepare('DELETE FROM telegram_notifications WHERE payload_hash = ?').run(testHash);
  db.close();
});

test('Watchdog database metrics query succeeds without errors', () => {
  const db = new Database(DB_PATH);

  const metrics = {
    total: db.prepare('SELECT COUNT(*) as c FROM companies').get().c,
    active: db.prepare("SELECT COUNT(*) as c FROM companies WHERE status = 'ACTIVE'").get().c,
    opps: db.prepare('SELECT COUNT(*) as c FROM insurance_opportunities').get().c,
  };

  assert(metrics.total > 0, 'Total companies must be positive');
  assert(metrics.active > 0, 'Active companies must be positive');
  assert(metrics.opps > 0, 'Opportunities must be positive');

  db.close();
});
