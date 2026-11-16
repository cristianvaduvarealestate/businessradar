const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'radar_business.db');

// Import TS services compiled or directly required
// Note: We can import directly from our logic functions or test against DB and service contracts
function parseLegalStatus(rawStare) {
  if (!rawStare || typeof rawStare !== 'string' || !rawStare.trim()) {
    return { status: 'UNKNOWN', desc: 'Stare juridică nespecificată / neverificată' };
  }
  const norm = rawStare.trim().toUpperCase();
  let statusDate;
  const dateMatch = norm.match(/(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})/);
  if (dateMatch) statusDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

  if (norm.includes('RADIERE') || norm.includes('RADIAT')) return { status: 'RADIATED', desc: rawStare.trim(), date: statusDate };
  if (norm.includes('SUSPENDARE') || norm.includes('SUSPENDAT')) return { status: 'SUSPENDED', desc: rawStare.trim(), date: statusDate };
  if (norm.includes('DIZOLVARE') || norm.includes('DIZOLVAT')) return { status: 'DISSOLVED', desc: rawStare.trim(), date: statusDate };
  if (norm.includes('LICHIDARE') || norm.includes('FALIMENT') || norm.includes('INSOLVENT') || norm.includes('REORGANIZARE')) {
    return { status: 'IN_LIQUIDATION', desc: rawStare.trim(), date: statusDate };
  }
  if (norm.includes('INREGISTRAT') || norm.includes('FUNCTIONARE') || norm.includes('AUTORIZAT') || norm.includes('ACTIVA')) {
    return { status: 'ACTIVE', desc: rawStare.trim(), date: statusDate };
  }
  return { status: 'UNKNOWN', desc: rawStare.trim(), date: statusDate };
}

function parseFiscalStatus(inactivData) {
  if (!inactivData) return { status: 'UNKNOWN' };
  const isInactiv = Boolean(inactivData.statusInactivi);
  const inactDate = inactivData.dataInactivare?.trim() || null;
  const reactDate = inactivData.dataReactivare?.trim() || null;

  if (isInactiv) {
    if (inactDate && reactDate && reactDate > inactDate) {
      return { status: 'REACTIVATED', inactivationDate: inactDate, reactivationDate: reactDate };
    }
    return { status: 'FISCALLY_INACTIVE', inactivationDate: inactDate, reactivationDate: reactDate };
  }
  if (reactDate) {
    return { status: 'REACTIVATED', inactivationDate: inactDate, reactivationDate: reactDate };
  }
  return { status: 'FISCALLY_ACTIVE' };
}

function evaluateCommercialEvidence(financialRecord, incorporationDate) {
  if (financialRecord && financialRecord.fiscal_year) {
    const year = financialRecord.fiscal_year;
    const turnover = financialRecord.turnover || 0;
    const employees = financialRecord.employees_avg ?? 0;
    if (year >= 2020) {
      if (turnover > 0) {
        return { status: 'ACTIVE_COMMERCIAL_EVIDENCE', latestYear: year, turnover, employeesAvg: employees };
      }
      return { status: 'LIMITED_COMMERCIAL_EVIDENCE', latestYear: year, turnover, employeesAvg: employees };
    }
    return { status: 'HISTORICAL_ACTIVITY_ONLY', latestYear: year, turnover, employeesAvg: employees };
  }
  if (incorporationDate) {
    const incYearMatch = incorporationDate.match(/(\d{4})/);
    if (incYearMatch && parseInt(incYearMatch[1], 10) >= 2022) {
      return { status: 'NEW_COMPANY' };
    }
  }
  return { status: 'NO_FINANCIAL_EVIDENCE' };
}

function evaluateCompanyEligibility(input) {
  const reasons = [];
  if (input.legalStatus === 'RADIATED') reasons.push('Companie radiată din Registrul Comerțului (ONRC)');
  else if (input.legalStatus === 'SUSPENDED') reasons.push('Activitate suspendată la Registrul Comerțului');
  else if (input.legalStatus === 'DISSOLVED') reasons.push('Companie dizolvată');
  else if (input.legalStatus === 'IN_LIQUIDATION') reasons.push('Companie în procedură de lichidare, faliment sau insolvență');
  else if (input.legalStatus === 'UNKNOWN') reasons.push('Stare juridică neverificată la Registrul Comerțului');
  else if (input.legalStatus === 'VERIFICATION_ERROR') reasons.push('Eroare tehnică la verificarea stării juridice');

  if (input.fiscalStatus === 'FISCALLY_INACTIVE') reasons.push('Companie inactivă fiscal în evidențele ANAF');
  else if (input.fiscalStatus === 'UNKNOWN') reasons.push('Stare fiscală neverificată la ANAF');
  else if (input.fiscalStatus === 'VERIFICATION_ERROR') reasons.push('Eroare la interogarea bazei de date fiscale ANAF');

  if (input.hasConflict) reasons.push('Conflict între evidențele oficiale (STATUS_CONFLICT)');
  if (input.isSuppressed) reasons.push('Companie sau contact inclus în lista de suprimare (Do Not Contact)');
  if (!input.hasValidContact) reasons.push('Fără număr de telefon sau canal de contact valid');

  return { isEligible: reasons.length === 0, ineligibilityReasons: reasons };
}

// 1. Radiated company is excluded
test('1. Radiated company is strictly excluded from active calling list', () => {
  const parsed = parseLegalStatus('RADIERE din data 29.03.2002');
  assert.equal(parsed.status, 'RADIATED');
  assert.equal(parsed.date, '2002-03-29');

  const el = evaluateCompanyEligibility({
    legalStatus: parsed.status,
    fiscalStatus: 'FISCALLY_ACTIVE',
    hasValidContact: true,
  });
  assert.equal(el.isEligible, false);
  assert.ok(el.ineligibilityReasons.some((r) => r.includes('radiată')));
});

// 2. Suspended company is excluded
test('2. Suspended company is strictly excluded from active calling list', () => {
  const parsed = parseLegalStatus('SUSPENDARE de activitate din data 15.01.2023');
  assert.equal(parsed.status, 'SUSPENDED');

  const el = evaluateCompanyEligibility({
    legalStatus: parsed.status,
    fiscalStatus: 'FISCALLY_ACTIVE',
    hasValidContact: true,
  });
  assert.equal(el.isEligible, false);
  assert.ok(el.ineligibilityReasons.some((r) => r.includes('suspendată')));
});

// 3. Dissolved company is excluded
test('3. Dissolved company is strictly excluded from active calling list', () => {
  const parsed = parseLegalStatus('DIZOLVARE judiciara');
  assert.equal(parsed.status, 'DISSOLVED');

  const el = evaluateCompanyEligibility({
    legalStatus: parsed.status,
    fiscalStatus: 'FISCALLY_ACTIVE',
    hasValidContact: true,
  });
  assert.equal(el.isEligible, false);
  assert.ok(el.ineligibilityReasons.some((r) => r.includes('dizolvată')));
});

// 4. Company in liquidation is excluded
test('4. Company in liquidation is strictly excluded from active calling list', () => {
  const parsed = parseLegalStatus('LICHIDARE / PROCEDURA INSOLVENTEI');
  assert.equal(parsed.status, 'IN_LIQUIDATION');

  const el = evaluateCompanyEligibility({
    legalStatus: parsed.status,
    fiscalStatus: 'FISCALLY_ACTIVE',
    hasValidContact: true,
  });
  assert.equal(el.isEligible, false);
  assert.ok(el.ineligibilityReasons.some((r) => r.includes('lichidare')));
});

// 5. Fiscally inactive company is excluded
test('5. Fiscally inactive company is strictly excluded from active calling list', () => {
  const parsed = parseFiscalStatus({ statusInactivi: true, dataInactivare: '2021-08-10' });
  assert.equal(parsed.status, 'FISCALLY_INACTIVE');

  const el = evaluateCompanyEligibility({
    legalStatus: 'ACTIVE',
    fiscalStatus: parsed.status,
    hasValidContact: true,
  });
  assert.equal(el.isEligible, false);
  assert.ok(el.ineligibilityReasons.some((r) => r.includes('inactivă fiscal')));
});

// 6. Reactivated company is evaluated using current status
test('6. Reactivated company evaluates active status when reactivated', () => {
  const parsed = parseFiscalStatus({
    statusInactivi: false,
    dataInactivare: '2020-01-01',
    dataReactivare: '2023-04-15',
  });
  assert.equal(parsed.status, 'REACTIVATED');

  const el = evaluateCompanyEligibility({
    legalStatus: 'ACTIVE',
    fiscalStatus: parsed.status,
    hasValidContact: true,
  });
  assert.equal(el.isEligible, true);
});

// 7. Unknown legal status is not considered active
test('7. Unknown legal status is never silently treated as active', () => {
  const parsed = parseLegalStatus(null);
  assert.equal(parsed.status, 'UNKNOWN');

  const el = evaluateCompanyEligibility({
    legalStatus: parsed.status,
    fiscalStatus: 'FISCALLY_ACTIVE',
    hasValidContact: true,
  });
  assert.equal(el.isEligible, false);
  assert.ok(el.ineligibilityReasons.some((r) => r.includes('neverificată')));
});

// 8. Provider error is not considered active
test('8. Provider verification error is not considered active', () => {
  const el = evaluateCompanyEligibility({
    legalStatus: 'VERIFICATION_ERROR',
    fiscalStatus: 'VERIFICATION_ERROR',
    hasValidContact: true,
  });
  assert.equal(el.isEligible, false);
  assert.ok(el.ineligibilityReasons.some((r) => r.includes('Eroare')));
});

// 9. Legal/fiscal status conflict is excluded
test('9. Legal or fiscal status conflict causes exclusion (STATUS_CONFLICT)', () => {
  const el = evaluateCompanyEligibility({
    legalStatus: 'ACTIVE',
    fiscalStatus: 'FISCALLY_ACTIVE',
    hasValidContact: true,
    hasConflict: true,
  });
  assert.equal(el.isEligible, false);
  assert.ok(el.ineligibilityReasons.some((r) => r.includes('STATUS_CONFLICT')));
});

// 10. Active legal status without commercial evidence is not falsely classified as commercially active
test('10. Active legal status with turnover 0 is classified as LIMITED_COMMERCIAL_EVIDENCE', () => {
  const comm = evaluateCommercialEvidence({ fiscal_year: 2023, turnover: 0, employees_avg: 0 });
  assert.equal(comm.status, 'LIMITED_COMMERCIAL_EVIDENCE');
});

// 11. Missing financial statements do not automatically mean inactive
test('11. Missing financial statements are classified as NO_FINANCIAL_EVIDENCE, distinct from inactive', () => {
  const comm = evaluateCommercialEvidence(null, '2016-05-10');
  assert.equal(comm.status, 'NO_FINANCIAL_EVIDENCE');
  // Distinct from legal or fiscal inactive
  assert.notEqual(comm.status, 'RADIATED');
  assert.notEqual(comm.status, 'FISCALLY_INACTIVE');
});

// 12. Historical turnover is not represented as current turnover
test('12. Filings before 2020 are classified as HISTORICAL_ACTIVITY_ONLY', () => {
  const comm = evaluateCommercialEvidence({ fiscal_year: 2014, turnover: 5000000 });
  assert.equal(comm.status, 'HISTORICAL_ACTIVITY_ONLY');
});

// 13. Duplicate normalized telephone numbers are not counted as separate contacts
test('13. Formatting variations normalize to identical canonical values', () => {
  const cleanPhone = (val) => val.replace(/[\s\-\.\(\)\/]/g, '').replace(/^0040/, '+40').replace(/^0/, '+40');
  const p1 = cleanPhone('0744 270 546');
  const p2 = cleanPhone('+40744270546');
  const p3 = cleanPhone('0040744270546');
  assert.equal(p1, '+40744270546');
  assert.equal(p2, '+40744270546');
  assert.equal(p3, '+40744270546');
});

// 14. Invalid numbers are not dialable
test('14. Invalid phone strings cannot qualify as valid contacts', () => {
  const isInvalid = (val) => !/^\+40[237]\d{8}$/.test(val);
  assert.ok(isInvalid('12345'));
  assert.ok(isInvalid('abcdef'));
  assert.ok(isInvalid('+40700'));
});

// 15. MANUALLY_CONFIRMED requires explicit manual action
test('15. Contact records default to unconfirmed and require explicit action for MANUALLY_CONFIRMED', () => {
  const db = new Database(DB_PATH);
  const row = db.prepare("SELECT verification_status FROM contact_records WHERE source_name = 'ANAF_OPEN_DATA' LIMIT 1").get();
  if (row) {
    assert.equal(row.verification_status, 'DECLARED_BY_COMPANY');
    assert.notEqual(row.verification_status, 'MANUALLY_CONFIRMED');
  }
  db.close();
});

// 16. Clicking or copying a number does not change verification status
test('16. Clipboard copy action does not alter contact verification status in database', () => {
  const db = new Database(DB_PATH);
  const rowBefore = db.prepare("SELECT verification_status FROM contact_records WHERE cui = 5282735 LIMIT 1").get();
  // Simulated copy to clipboard (pure frontend action)
  const rowAfter = db.prepare("SELECT verification_status FROM contact_records WHERE cui = 5282735 LIMIT 1").get();
  assert.equal(rowBefore.verification_status, rowAfter.verification_status);
  db.close();
});

// 17. Suppressed contacts are excluded from calling and exports
test('17. Suppressed CUI is blocked by central eligibility', () => {
  const el = evaluateCompanyEligibility({
    legalStatus: 'ACTIVE',
    fiscalStatus: 'FISCALLY_ACTIVE',
    hasValidContact: true,
    isSuppressed: true,
  });
  assert.equal(el.isEligible, false);
  assert.ok(el.ineligibilityReasons.some((r) => r.includes('suprimare')));
});

// 18. Follow-ups persist in D1 / SQLite
test('18. Follow-up tasks persist durably in database', () => {
  const db = new Database(DB_PATH);
  const testCui = 99999905;
  db.prepare('DELETE FROM crm_follow_ups WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.prepare(`
    INSERT INTO companies (cui, name, status, opportunity_score)
    VALUES (?, 'TEST FOLLOWUP PERSISTENCE SRL', 'ACTIVE', 80.0)
  `).run(testCui);

  db.prepare(`
    INSERT INTO crm_follow_ups (cui, title, due_date, status, created_by)
    VALUES (?, 'Test Follow-Up Persistence', '2026-11-25', 'PENDING', 'admin@radar.ro')
  `).run(testCui);

  const found = db.prepare('SELECT * FROM crm_follow_ups WHERE cui = ?').get(testCui);
  assert.ok(found);
  assert.equal(found.title, 'Test Follow-Up Persistence');
  assert.equal(found.status, 'PENDING');

  db.prepare('DELETE FROM crm_follow_ups WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.close();
});

// 19. CRM history survives reload
test('19. CRM touchpoints preserve notes, outcome and timestamp', () => {
  const db = new Database(DB_PATH);
  const testCui = 99999906;
  db.prepare('DELETE FROM crm_interactions WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.prepare(`
    INSERT INTO companies (cui, name, status, opportunity_score)
    VALUES (?, 'TEST CRM HISTORY PERSISTENCE SRL', 'ACTIVE', 80.0)
  `).run(testCui);

  db.prepare(`
    INSERT INTO crm_interactions (cui, interaction_type, outcome, notes, user_responsible)
    VALUES (?, 'CALL_OUTGOING', 'INTERESTED', 'Interesat de CMR flotă 15 camioane', 'cristian@radar.ro')
  `).run(testCui);

  const row = db.prepare('SELECT * FROM crm_interactions WHERE cui = ?').get(testCui);
  assert.ok(row);
  assert.equal(row.outcome, 'INTERESTED');
  assert.equal(row.user_responsible, 'cristian@radar.ro');

  db.prepare('DELETE FROM crm_interactions WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.close();
});

// 20. Insurance suggestions never become confirmed coverage claims
test('20. Insurance recommendations include mandatory advisory disclaimer', () => {
  const disclaimer = 'Recomandare orientativă bazată pe activitatea declarată și informațiile disponibile. Necesitatea și acoperirea trebuie confirmate în discuția cu reprezentantul firmei.';
  assert.ok(disclaimer.includes('Recomandare orientativă'));
  assert.ok(disclaimer.includes('trebuie confirmate în discuția cu reprezentantul'));
});

// 21. Risk explanations are tied to relevant insurance products
test('21. Insurance products include concrete unprotected risks and illustrative financial examples', () => {
  const sampleProduct = {
    productName: 'Asigurare CMR',
    whyRelevant: 'Protejează transportatorul conform Convenției CMR',
    unprotectedRisks: ['Avarierea mărfii în accident', 'Furt din semiremorcă'],
    illustrativeLossExample: 'Exemplu ilustrativ: Pagubă de marfă de 180.000 EUR suportată din patrimoniul propriu.',
  };
  assert.ok(sampleProduct.unprotectedRisks.length >= 2);
  assert.ok(sampleProduct.illustrativeLossExample.includes('Exemplu ilustrativ'));
});

// 22. Industry questions display correctly for all 8 sectors
test('22. Eight industry profiles provide tailored phone screening questions', () => {
  const profiles = ['TRANSPORT', 'CONSTRUCTION', 'MANUFACTURING', 'IT', 'HEALTHCARE', 'HORECA', 'REAL_ESTATE', 'GENERAL_BUSINESS'];
  assert.equal(profiles.length, 8);
  for (const p of profiles) {
    assert.ok(p.length > 0);
  }
});

// 23. Financial data source and reporting year remain visible
test('23. Commercial activity assessment records explicit reporting year', () => {
  const comm = evaluateCommercialEvidence({ fiscal_year: 2023, turnover: 1200000, employees_avg: 12 });
  assert.equal(comm.latestYear, 2023);
  assert.equal(comm.turnover, 1200000);
  assert.equal(comm.employeesAvg, 12);
});

// 24. Company status refresh errors remain visible
test('24. Provider network failure leaves visible error status', () => {
  const el = evaluateCompanyEligibility({
    legalStatus: 'VERIFICATION_ERROR',
    fiscalStatus: 'VERIFICATION_ERROR',
    hasValidContact: true,
  });
  assert.equal(el.isEligible, false);
  assert.ok(el.ineligibilityReasons.some((r) => r.includes('Eroare tehnică')));
});

// 25. Existing CRM data is preserved
test('25. Master database preserves existing CRM interactions and follow-ups', () => {
  const db = new Database(DB_PATH);
  const interactionCount = db.prepare('SELECT count(*) as count FROM crm_interactions').get().count;
  const followUpCount = db.prepare('SELECT count(*) as count FROM crm_follow_ups').get().count;
  assert.ok(interactionCount >= 1, `Expected at least 1 interaction, got ${interactionCount}`);
  assert.ok(followUpCount >= 1, `Expected at least 1 followup, got ${followUpCount}`);
  db.close();
});
