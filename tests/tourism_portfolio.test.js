const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'radar_business.db');

test('Tourism Portfolio — Ground Truth Reconciled to exactly 30,874 units', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const tourismCount = db.prepare(`
    SELECT count(*) as count
    FROM prospect_records
    WHERE portfolio_type = 'TOURISM_UNITS';
  `).get();

  assert.strictEqual(tourismCount.count, 30874, 'Tourism units count must be exactly 30,874');

  // Verify historical invariants remain 100% intact
  const generalCount = db.prepare("SELECT count(*) as count FROM prospect_records WHERE portfolio_type = 'GENERAL';").get();
  assert.strictEqual(generalCount.count, 304, 'General portfolio must remain strictly 304');

  const nicheCount = db.prepare("SELECT count(*) as count FROM prospect_records WHERE portfolio_type = 'NICHE_HORECA_AUTO_CONSTRUCT';").get();
  assert.strictEqual(nicheCount.count, 25, 'Niche portfolio must remain strictly 25');

  const companiesCount = db.prepare("SELECT count(*) as count FROM companies;").get();
  assert.strictEqual(companiesCount.count, 2908, 'Historical ONRC companies must remain strictly 2,908');

  db.close();
});

test('Tourism Portfolio — Preserves all 16 original fields without inventing data', () => {
  const db = new Database(DB_PATH, { readonly: true });

  // Sample a record with known fields (EMAFIN row 11)
  const sample = db.prepare(`
    SELECT *
    FROM prospect_records
    WHERE portfolio_type = 'TOURISM_UNITS' AND unit_name = 'EMAFIN'
    LIMIT 1;
  `).get();

  assert.ok(sample, 'Record EMAFIN must exist');
  assert.strictEqual(sample.unit_type, 'CĂSUȚE TIP CAMPING');
  assert.strictEqual(sample.unit_classification, '3 - STELE');
  assert.strictEqual(sample.rooms_count, '5');
  assert.strictEqual(sample.beds_count, '20');
  assert.strictEqual(sample.operator_name, 'EMAFIN BN SRL');
  assert.strictEqual(sample.reg_com, 'J6/312/2009');
  assert.strictEqual(sample.cui, '25702779');
  assert.strictEqual(sample.commercial_status, 'NEW_UNVERIFIED');

  const emails = JSON.parse(sample.emails);
  assert.strictEqual(emails[0], 'nicoleta.clapa@ama-consult.ro');

  const raw = JSON.parse(sample.raw_content);
  assert.strictEqual(raw.numar_autorizatie, '40421');
  assert.strictEqual(raw.data_emitere_autorizatie, '05.11.2024');

  db.close();
});

test('Tourism Portfolio — Preserves #N/A and does not invent missing CUI', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const naCount = db.prepare(`
    SELECT count(*) as count
    FROM prospect_records
    WHERE portfolio_type = 'TOURISM_UNITS' AND cui IN ('#N/A', 'N/A');
  `).get();

  // Exactly 391 records had #N/A in source
  assert.strictEqual(naCount.count, 391, 'Records with #N/A must be preserved verbatim without mutation');

  db.close();
});

test('Tourism Portfolio — All records start at initial status NEW_UNVERIFIED', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const nonNewCount = db.prepare(`
    SELECT count(*) as count
    FROM prospect_records
    WHERE portfolio_type = 'TOURISM_UNITS' AND commercial_status != 'NEW_UNVERIFIED';
  `).get();

  assert.strictEqual(nonNewCount.count, 0, 'All initial tourism records must be NEW_UNVERIFIED');

  db.close();
});

test('Tourism Portfolio — Individual CRM Dossier interaction can be recorded and rolled back', () => {
  const db = new Database(DB_PATH);

  const prospect = db.prepare(`
    SELECT id, company_name, commercial_status
    FROM prospect_records
    WHERE portfolio_type = 'TOURISM_UNITS'
    LIMIT 1;
  `).get();

  assert.ok(prospect, 'Must find a tourism prospect');

  const testDiscId = `test_disc_tour_${Date.now()}`;
  db.prepare(`
    INSERT INTO prospect_discussions (
      id, prospect_id, interaction_date, interaction_type,
      contact_person, discussion_summary, outcome, next_step, next_callback_date
    ) VALUES (?, ?, datetime('now'), 'CALL', 'Manager Cazare', 'Test call - interesat asigurare cladire', 'INTERESTED', 'Trimite oferta', date('now', '+3 days'));
  `).run(testDiscId, prospect.id);

  // Update prospect status
  db.prepare(`
    UPDATE prospect_records
    SET commercial_status = 'DISCUSSION_IN_PROGRESS', next_callback_date = date('now', '+3 days'), updated_at = datetime('now')
    WHERE id = ?;
  `).run(prospect.id);

  const updated = db.prepare("SELECT commercial_status, next_callback_date FROM prospect_records WHERE id = ?;").get(prospect.id);
  assert.strictEqual(updated.commercial_status, 'DISCUSSION_IN_PROGRESS');
  assert.ok(updated.next_callback_date);

  // Clean up test data completely
  db.prepare("DELETE FROM prospect_discussions WHERE id = ?;").run(testDiscId);
  db.prepare("UPDATE prospect_records SET commercial_status = 'NEW_UNVERIFIED', next_callback_date = NULL WHERE id = ?;").run(prospect.id);

  const reverted = db.prepare("SELECT commercial_status FROM prospect_records WHERE id = ?;").get(prospect.id);
  assert.strictEqual(reverted.commercial_status, 'NEW_UNVERIFIED');

  db.close();
});
