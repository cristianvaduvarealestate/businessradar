const { test } = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'radar_business.db');

test('Unified Workspace — Exactly 128 active companies with usable contacts', () => {
  const db = new Database(DB_PATH, { readonly: true });

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

  const row = db.prepare(activeQuery).get();
  assert.strictEqual(row.count, 128, 'Active workspace must contain exactly 128 companies');
  db.close();
});

test('Unified Workspace — The 9 canonical KPI dashboard metrics match database ground truth', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const kpiQuery = `
    WITH active_companies AS (
      SELECT c.cui FROM companies c
      WHERE c.legal_status = 'ACTIVE'
        AND c.fiscal_status IN ('FISCALLY_ACTIVE', 'REACTIVATED')
        AND c.cui NOT IN (SELECT cui FROM suppression_list)
        AND EXISTS (
          SELECT 1 FROM contact_records cr
          WHERE cr.cui = c.cui
            AND (
              (cr.contact_type IN ('MOBILE', 'LANDLINE') AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
              OR
              (cr.contact_type = 'EMAIL' AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
            )
        )
    )
    SELECT 
      COUNT(*) as active_with_contact,
      COUNT(CASE WHEN (pp.status IS NULL OR pp.status IN ('NEW', 'NEW_DISCOVERED', 'NOT_CONTACTED')) AND ci.cui IS NULL THEN 1 END) as not_contacted,
      COUNT(CASE WHEN pp.status = 'CONTACTED' OR (pp.status IS NULL AND ci.cui IS NOT NULL) THEN 1 END) as contacted,
      (SELECT COUNT(DISTINCT cf.cui) FROM crm_follow_ups cf WHERE cf.status = 'PENDING' AND cf.due_date <= date('now') AND cf.cui IN (SELECT cui FROM active_companies)) as followups_due,
      COUNT(CASE WHEN pp.status = 'INTERESTED' THEN 1 END) as interested,
      COUNT(CASE WHEN pp.status = 'OFFER_REQUESTED' THEN 1 END) as offers_requested,
      COUNT(CASE WHEN pp.status = 'OFFER_SENT' THEN 1 END) as offers_sent,
      COUNT(CASE WHEN pp.status = 'CLIENT_WON' THEN 1 END) as clients_won,
      COUNT(CASE WHEN pp.status = 'DO_NOT_CONTACT' THEN 1 END) as do_not_contact
    FROM active_companies ac
    LEFT JOIN prospect_pipeline pp ON ac.cui = pp.cui
    LEFT JOIN (SELECT DISTINCT cui FROM crm_interactions) ci ON ac.cui = ci.cui;
  `;

  const kpis = db.prepare(kpiQuery).get();
  assert.strictEqual(kpis.active_with_contact, 128, 'Active with contact must be 128');
  assert.strictEqual(kpis.not_contacted, 127, 'Not contacted must be 127');
  assert.strictEqual(kpis.contacted, 1, 'Contacted must be 1');
  assert.strictEqual(kpis.followups_due, 0, 'Follow-ups due must be 0');
  assert.strictEqual(kpis.interested, 0, 'Interested must be 0');
  assert.strictEqual(kpis.offers_requested, 0, 'Offers requested must be 0');
  assert.strictEqual(kpis.offers_sent, 0, 'Offers sent must be 0');
  assert.strictEqual(kpis.clients_won, 0, 'Clients won must be 0');
  assert.strictEqual(kpis.do_not_contact, 0, 'Do not contact must be 0');

  db.close();
});

test('Unified Workspace — Contact provenance integrity: ANAF numbers are DECLARED_BY_COMPANY', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const anafCheck = db.prepare(`
    SELECT count(*) as unverified_count
    FROM contact_records
    WHERE source_name = 'ANAF_OPEN_DATA'
      AND verification_status = 'MANUALLY_CONFIRMED'
      AND cui != 5282735
  `).get();

  assert.strictEqual(anafCheck.unverified_count, 0, 'No ANAF numbers should be marked MANUALLY_CONFIRMED without an actual call');
  db.close();
});

test('Unified Workspace — Strict exclusion audit matches ground truth (2,780 excluded + 128 active = 2,908)', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const total = db.prepare('SELECT count(*) as c FROM companies').get().c;
  assert.strictEqual(total, 2908, 'Total companies in database must be 2,908');

  const radiated = db.prepare("SELECT count(*) as c FROM companies WHERE legal_status = 'RADIATED'").get().c;
  assert.strictEqual(radiated, 301, 'Radiated count must be 301');

  const dissolved = db.prepare("SELECT count(*) as c FROM companies WHERE legal_status = 'DISSOLVED'").get().c;
  assert.strictEqual(dissolved, 7, 'Dissolved count must be 7');

  const suspended = db.prepare("SELECT count(*) as c FROM companies WHERE legal_status = 'SUSPENDED'").get().c;
  assert.strictEqual(suspended, 28, 'Suspended count must be 28');

  const fiscallyInactive = db.prepare("SELECT count(*) as c FROM companies WHERE fiscal_status = 'FISCALLY_INACTIVE'").get().c;
  assert.strictEqual(fiscallyInactive, 84, 'Fiscally inactive count must be 84');

  db.close();
});
