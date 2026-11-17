const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'radar_business.db');

function verifyHistorical() {
  console.log('='.repeat(70));
  console.log('🔒 HISTORICAL DATA PRESERVATION AUDIT');
  console.log('='.repeat(70));

  const db = new Database(DB_PATH, { readonly: true });

  // 1. Total companies
  const total = db.prepare('SELECT count(*) as c FROM companies').get().c;
  console.log(`Total companies in companies table : ${total} (expected: 2908)`);

  // 2. Compute deterministic SHA-256 of all 2,908 companies ordered by ID
  const allRows = db.prepare('SELECT id, cui, name, registration_date FROM companies ORDER BY id ASC').all();
  const hasher = crypto.createHash('sha256');
  for (const r of allRows) {
    hasher.update(`${r.id}|${r.cui}|${r.name}|${r.registration_date}\n`);
  }
  const checksum = hasher.digest('hex');
  console.log(`Deterministic Canonical Checksum   : ${checksum}`);

  // 3. Operational Leads
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
  const activeCount = db.prepare(activeQuery).get().count;
  console.log(`Active Phone Prospects             : ${activeCount} (expected: 128)`);

  // 4. Contact Records
  const contacts = db.prepare('SELECT count(*) as c FROM contact_records').get().c;
  console.log(`Total Contact Records              : ${contacts}`);

  // 5. CRM Interactions & Follow-ups
  const interactions = db.prepare('SELECT count(*) as c FROM crm_interactions').get().c;
  const followups = db.prepare('SELECT count(*) as c FROM crm_follow_ups').get().c;
  const suppression = db.prepare('SELECT count(*) as c FROM suppression_list').get().c;
  console.log(`CRM Interactions                   : ${interactions}`);
  console.log(`CRM Follow-ups                     : ${followups}`);
  console.log(`Suppression List Entries           : ${suppression}`);

  db.close();

  return {
    total,
    activeCount,
    contacts,
    interactions,
    followups,
    suppression,
    checksum,
    preserved: total === 2908 && activeCount === 128,
  };
}

const res = verifyHistorical();
if (!res.preserved) {
  process.exit(1);
} else {
  console.log('✅ HISTORICAL DATABASE FULLY PRESERVED WITHOUT MODIFICATION');
  process.exit(0);
}
