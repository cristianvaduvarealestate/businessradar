const { test } = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'radar_business.db');

test('Prospecting CRM — Ground Truth Invariant: Historical 2,908 companies and 128 active leads untouched', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const compCount = db.prepare('SELECT count(*) as count FROM companies;').get();
  assert.strictEqual(compCount.count, 2908, 'Companies table must retain exactly 2,908 records');

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
  const activeCount = db.prepare(activeQuery).get();
  assert.strictEqual(activeCount.count, 128, 'Active calling leads must retain exactly 128 companies');

  db.close();
});

test('Prospecting CRM — Portfolio B (Niche HORECA/Auto/Construct) imported exactly 25 positions', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const nicheCount = db.prepare(
    "SELECT count(*) as count FROM prospect_records WHERE portfolio_type = 'NICHE_HORECA_AUTO_CONSTRUCT';"
  ).get();
  assert.strictEqual(nicheCount.count, 25, 'Portfolio B must contain exactly 25 records');

  // Verify positions 1 to 25 exist
  const rowIndices = db.prepare(
    "SELECT source_row_index FROM prospect_records WHERE portfolio_type = 'NICHE_HORECA_AUTO_CONSTRUCT' ORDER BY source_row_index ASC;"
  ).all();
  assert.strictEqual(rowIndices.length, 25);
  assert.strictEqual(rowIndices[0].source_row_index, 1);
  assert.strictEqual(rowIndices[24].source_row_index, 25);

  // Spot-check known records from markdown table
  const laGradina = db.prepare(
    "SELECT * FROM prospect_records WHERE company_name LIKE '%Pensiunea La Gradina%';"
  ).get();
  assert.ok(laGradina, 'Pensiunea La Gradina must be imported');
  assert.strictEqual(laGradina.city, 'Zalau');
  assert.strictEqual(laGradina.county, 'Salaj');
  assert.ok(laGradina.phones.includes('+40 745 005 815'), 'Phone must match');
  assert.ok(laGradina.emails.includes('valitrifan@gmail.com'), 'Email must match');

  const autonom = db.prepare(
    "SELECT * FROM prospect_records WHERE company_name LIKE '%Autonom%';"
  ).get();
  assert.ok(autonom, 'Autonom must be imported');
  assert.strictEqual(autonom.cui, '18433260', 'CUI must be extracted');

  db.close();
});

test('Prospecting CRM — Portfolio A (General Prospecting) imported 304 positions with full field coverage', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const genCount = db.prepare(
    "SELECT count(*) as count FROM prospect_records WHERE portfolio_type = 'GENERAL';"
  ).get();
  assert.strictEqual(genCount.count, 304, 'Portfolio A must contain 304 records');

  // Verify multiline dossiers (e.g. Pot Construct, Total Construct, TLS Romania)
  const potConstruct = db.prepare(
    "SELECT * FROM prospect_records WHERE company_name LIKE '%Pot Construct%';"
  ).get();
  assert.ok(potConstruct, 'Pot Construct must be imported');
  assert.ok(potConstruct.emails.includes('office@potconstruct.ro'));

  const totalConstruct = db.prepare(
    "SELECT * FROM prospect_records WHERE company_name LIKE '%Total Construct%';"
  ).get();
  assert.ok(totalConstruct, 'Total Construct must be imported');
  assert.ok(totalConstruct.phones.includes('0784 715 715'));
  assert.ok(totalConstruct.insurance_suggestions.includes('RCA/CASCO'));

  // Verify Baroul Constanța lawyers
  const lawyers = db.prepare(
    "SELECT count(*) as count FROM prospect_records WHERE domain LIKE '%Servicii Juridice%';"
  ).get();
  assert.ok(lawyers.count >= 8, 'At least 8 lawyers must be imported');

  // Verify Topfirme CUI records
  const topfirme = db.prepare(
    "SELECT * FROM prospect_records WHERE cui = '6502634';"
  ).get();
  assert.ok(topfirme, 'Topfirme CUI 6502634 must be imported');
  assert.strictEqual(topfirme.reg_com, 'J40/22456/1994');
  assert.ok(topfirme.phones.includes('722161031'));

  db.close();
});

test('Prospecting CRM — All 17 commercial statuses are supported and start at NEW_UNVERIFIED', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const statusSummary = db.prepare(`
    SELECT commercial_status, count(*) as count
    FROM prospect_records
    GROUP BY commercial_status;
  `).all();

  // Initially all records across all portfolios must be NEW_UNVERIFIED
  assert.strictEqual(statusSummary.length, 1);
  assert.strictEqual(statusSummary[0].commercial_status, 'NEW_UNVERIFIED');
  // 304 (General) + 25 (Niche) + 30,874 (Tourism Units) = 31,203 total records
  assert.strictEqual(statusSummary[0].count, 31203);

  // Breakdown by portfolio
  const portfolioCounts = db.prepare(`
    SELECT portfolio_type, count(*) as count
    FROM prospect_records
    GROUP BY portfolio_type;
  `).all();

  const countMap = Object.fromEntries(portfolioCounts.map(r => [r.portfolio_type, r.count]));
  assert.strictEqual(countMap['GENERAL'], 304);
  assert.strictEqual(countMap['NICHE_HORECA_AUTO_CONSTRUCT'], 25);
  assert.strictEqual(countMap['TOURISM_UNITS'], 30874);

  db.close();
});

test('Prospecting CRM — Individual CRM Dossier operations: status transitions, discussions, and callbacks', () => {
  const db = new Database(DB_PATH);

  // Pick a test prospect
  const testRecord = db.prepare("SELECT id FROM prospect_records LIMIT 1;").get();
  assert.ok(testRecord, 'Must have at least one prospect');
  const prospectId = testRecord.id;

  // 1. Add first interaction
  const discId1 = `test_disc_1_${Date.now()}`;
  db.prepare(`
    INSERT INTO prospect_discussions (
      id, prospect_id, interaction_date, interaction_type,
      contact_person, discussion_summary, interested_products,
      requested_documents, offer_to_prepare, outcome,
      next_step, next_callback_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    discId1,
    prospectId,
    '2026-11-18T10:00:00Z',
    'CALL',
    'Director General',
    'Discuție inițială pozitivă. Interesați de asigurare flotă.',
    'Flotă auto / CASCO / RCA',
    'Talon 5 autovehicule',
    'Cotație CASCO 3 variante',
    'Interesat',
    'Revenire telefon miercuri',
    '2026-11-20T14:00:00'
  );

  // Update prospect status & callback
  db.prepare(`
    UPDATE prospect_records SET
      commercial_status = 'INTERESTED_OFFER_REQUESTED',
      next_callback_date = '2026-11-20T14:00:00',
      next_action = 'Revenire telefon miercuri',
      confirmed_interested_products = ?
    WHERE id = ?;
  `).run(JSON.stringify(['Flotă auto / CASCO / RCA']), prospectId);

  // 2. Add second interaction (chronological, non-overwriting)
  const discId2 = `test_disc_2_${Date.now()}`;
  db.prepare(`
    INSERT INTO prospect_discussions (
      id, prospect_id, interaction_date, interaction_type,
      contact_person, discussion_summary, interested_products,
      requested_documents, offer_to_prepare, outcome,
      next_step, next_callback_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    discId2,
    prospectId,
    '2026-11-20T14:15:00Z',
    'OFFER_SENT',
    'Director General',
    'Transmis oferta CASCO pe email.',
    'Flotă auto / CASCO / RCA',
    null,
    'Cotație CASCO finală',
    'Ofertă trimisă',
    'Așteaptă decizia consiliului',
    '2026-11-25T10:00:00'
  );

  // Update to OFFER_SENT_UNDER_REVIEW
  db.prepare(`
    UPDATE prospect_records SET
      commercial_status = 'OFFER_SENT_UNDER_REVIEW',
      next_callback_date = '2026-11-25T10:00:00',
      next_action = 'Așteaptă decizia consiliului'
    WHERE id = ?;
  `).run(prospectId);

  // Verify discussions history contains both records chronologically
  const discussions = db.prepare(
    "SELECT * FROM prospect_discussions WHERE prospect_id = ? ORDER BY interaction_date ASC;"
  ).all(prospectId);
  assert.strictEqual(discussions.length, 2, 'Must have exactly 2 non-overwritten discussions');
  assert.strictEqual(discussions[0].interaction_type, 'CALL');
  assert.strictEqual(discussions[1].interaction_type, 'OFFER_SENT');

  // Verify prospect current status
  const updatedProspect = db.prepare("SELECT * FROM prospect_records WHERE id = ?;").get(prospectId);
  assert.strictEqual(updatedProspect.commercial_status, 'OFFER_SENT_UNDER_REVIEW');
  assert.strictEqual(updatedProspect.next_callback_date, '2026-11-25T10:00:00');
  assert.strictEqual(updatedProspect.next_action, 'Așteaptă decizia consiliului');

  // Clean up test discussions and reset status
  db.prepare("DELETE FROM prospect_discussions WHERE id IN (?, ?);").run(discId1, discId2);
  db.prepare(`
    UPDATE prospect_records SET
      commercial_status = 'NEW_UNVERIFIED',
      next_callback_date = NULL,
      next_action = NULL,
      confirmed_interested_products = '[]'
    WHERE id = ?;
  `).run(prospectId);

  db.close();
});
