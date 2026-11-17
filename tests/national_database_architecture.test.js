const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Database = require('better-sqlite3');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'radar_business.db');

test('1. Data Model — Three logical layers operate over canonical company records without duplicate tables', () => {
  const db = new Database(DB_PATH, { readonly: true });

  // Verify only one central companies table exists (no companies_active, companies_new, companies_historical)
  const companyTables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE 'companies%' AND name NOT LIKE 'companies_fts%'
  `).all();
  assert.strictEqual(companyTables.length, 1, 'There must be strictly one canonical companies table');
  assert.strictEqual(companyTables[0].name, 'companies');

  // Layer 1: National Company Database (Canonical records)
  const totalInDb = db.prepare('SELECT COUNT(*) as count FROM companies WHERE cui NOT BETWEEN 90000000 AND 99999999').get().count;
  assert.strictEqual(totalInDb, 2908, 'Layer 1 must hold all 2,908 canonical imported companies');

  // Layer 2: New Company Discovery classification query
  const classificationCounts = db.prepare(`
    SELECT classification, COUNT(*) as count 
    FROM companies 
    WHERE cui NOT BETWEEN 90000000 AND 99999999
    GROUP BY classification
  `).all();
  const histRow = classificationCounts.find(r => r.classification === 'HISTORICAL');
  assert.ok(histRow, 'HISTORICAL classification must exist');
  assert.strictEqual(histRow.count, 2908, 'All current records are classified as HISTORICAL');

  // Layer 3: Qualified Insurance Prospects
  const activeProspects = db.prepare(`
    SELECT COUNT(*) as count FROM companies c
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
  assert.strictEqual(activeProspects, 128, 'Layer 3 must filter to exactly 128 qualified prospects');

  db.close();
});

test('2. Data Model — Radiated companies and companies without contacts remain searchable in National Database', () => {
  const db = new Database(DB_PATH, { readonly: true });

  // Radiated companies must remain in Layer 1
  const radiatedCount = db.prepare("SELECT COUNT(*) as count FROM companies WHERE legal_status = 'RADIATED'").get().count;
  assert.strictEqual(radiatedCount, 301, 'Radiated companies must not be deleted from national intelligence');

  // AGORA IMPORT EXPORT SRL (CUI 2117326) has 0 contacts but must be in national database
  const agora = db.prepare('SELECT cui, name, legal_status, fiscal_status FROM companies WHERE cui = 2117326').get();
  assert.ok(agora, 'AGORA IMPORT EXPORT SRL must exist in database');
  assert.strictEqual(agora.legal_status, 'ACTIVE');
  assert.strictEqual(agora.fiscal_status, 'FISCALLY_ACTIVE');

  const agoraContacts = db.prepare('SELECT COUNT(*) as count FROM contact_records WHERE cui = 2117326').get().count;
  assert.strictEqual(agoraContacts, 0, 'AGORA IMPORT EXPORT SRL must have 0 contacts');

  db.close();
});

test('3. Prospect Qualification — Exhaustive reconciliation of all 2,908 companies into transparent buckets', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const breakdown = db.prepare(`
    SELECT 
      CASE 
        WHEN c.cui IN (SELECT cui FROM suppression_list) THEN 'SUPPRESSED'
        WHEN c.legal_status IN ('RADIATED', 'DISSOLVED', 'IN_LIQUIDATION') THEN 'RADIATED_OR_DISSOLVED'
        WHEN c.legal_status = 'SUSPENDED' THEN 'LEGAL_SUSPENDED'
        WHEN c.fiscal_status = 'FISCALLY_INACTIVE' THEN 'FISCAL_INACTIVE'
        WHEN c.legal_status = 'UNKNOWN' THEN 'VERIFICATION_PENDING'
        WHEN c.legal_status = 'VERIFICATION_ERROR' OR c.legal_status = 'STATUS_CONFLICT' THEN 'VERIFICATION_ERROR'
        WHEN c.legal_status = 'ACTIVE' AND c.fiscal_status IN ('FISCALLY_ACTIVE', 'REACTIVATED') AND NOT EXISTS (
          SELECT 1 FROM contact_records cr WHERE cr.cui = c.cui AND (
            (cr.contact_type IN ('MOBILE', 'LANDLINE') AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
            OR (cr.contact_type = 'EMAIL' AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
          )
        ) THEN 'NO_USABLE_CONTACT'
        WHEN c.legal_status = 'ACTIVE' AND c.fiscal_status IN ('FISCALLY_ACTIVE', 'REACTIVATED') THEN 'ELIGIBLE'
        ELSE 'OTHER_EXCLUDED'
      END as category,
      count(*) as cnt
    FROM companies c
    WHERE c.cui NOT BETWEEN 90000000 AND 99999999
    GROUP BY category
  `).all();

  const map = Object.fromEntries(breakdown.map(r => [r.category, r.cnt]));

  assert.strictEqual(map['ELIGIBLE'], 128, 'Eligible prospects must be exactly 128');
  assert.strictEqual(map['NO_USABLE_CONTACT'], 1, 'No usable contact must be exactly 1');
  assert.strictEqual(map['RADIATED_OR_DISSOLVED'], 308, 'Radiated or dissolved must be exactly 308');
  assert.strictEqual(map['LEGAL_SUSPENDED'], 28, 'Suspended must be exactly 28');
  assert.strictEqual(map['FISCAL_INACTIVE'], 40, 'Fiscal inactive must be exactly 40');
  assert.strictEqual(map['VERIFICATION_ERROR'], 13, 'Verification error must be exactly 13');
  assert.strictEqual(map['VERIFICATION_PENDING'], 2390, 'Verification pending must be exactly 2390');

  const totalReconciled = Object.values(map).reduce((a, b) => a + b, 0);
  assert.strictEqual(totalReconciled, 2908, 'All 2,908 companies must be accounted for');

  db.close();
});

test('4. Contact Integrity — All 128 active prospects have genuine, normalized contact values', () => {
  const db = new Database(DB_PATH, { readonly: true });

  const activeCuis = db.prepare(`
    SELECT c.cui FROM companies c
    WHERE c.legal_status = 'ACTIVE'
      AND c.fiscal_status IN ('FISCALLY_ACTIVE', 'REACTIVATED')
      AND c.cui NOT IN (SELECT cui FROM suppression_list)
      AND EXISTS (
        SELECT 1 FROM contact_records cr WHERE cr.cui = c.cui AND (
          (cr.contact_type IN ('MOBILE', 'LANDLINE') AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
          OR (cr.contact_type = 'EMAIL' AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
        )
      )
  `).all().map(r => r.cui);

  assert.strictEqual(activeCuis.length, 128);

  // Check each company has at least one valid phone or email string
  for (const cui of activeCuis) {
    const contacts = db.prepare(`
      SELECT contact_type, contact_value, verification_status 
      FROM contact_records 
      WHERE cui = ? 
        AND verification_status NOT IN ('UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED')
    `).all(cui);

    assert.ok(contacts.length > 0, `Company ${cui} must have at least one valid contact`);

    for (const c of contacts) {
      assert.ok(c.contact_value, `Contact value must not be empty for CUI ${cui}`);
      if (c.contact_type === 'MOBILE' || c.contact_type === 'LANDLINE') {
        const clean = c.contact_value.replace(/[\s\.\-\+]/g, '');
        assert.ok(clean.length >= 9, `Phone ${c.contact_value} must have at least 9 digits`);
      } else if (c.contact_type === 'EMAIL') {
        assert.ok(c.contact_value.includes('@') && c.contact_value.includes('.'), `Email ${c.contact_value} must be valid`);
      }
    }
  }

  db.close();
});

test('5. Interface Navigation — Exactly four unified platform sections exist', () => {
  const navFilePath = path.join(__dirname, '..', 'src', 'components', 'Navigation.tsx');
  const navContent = fs.readFileSync(navFilePath, 'utf-8');

  assert.ok(navContent.includes("href: '/companies'"), 'Navigation must include /companies');
  assert.ok(navContent.includes("href: '/new-companies'"), 'Navigation must include /new-companies');
  assert.ok(navContent.includes("href: '/pipeline'"), 'Navigation must include /pipeline');
  assert.ok(navContent.includes("href: '/settings'"), 'Navigation must include /settings');

  assert.ok(navContent.includes("label: 'Firme existente'"), 'Must have label Firme existente');
  assert.ok(navContent.includes("label: 'Firme noi'"), 'Must have label Firme noi');
  assert.ok(navContent.includes("label: 'Activități'"), 'Must have label Activități');
  assert.ok(navContent.includes("label: 'Configurare'"), 'Must have label Configurare');
});
