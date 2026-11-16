const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'radar_business.db');

test('CRM Interactions table logs touchpoints with user provenance', () => {
  const db = new Database(DB_PATH);
  
  // Clean test CUI
  const testCui = 99999901;
  db.prepare('DELETE FROM crm_interactions WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);

  db.prepare(`
    INSERT INTO companies (cui, name, status, opportunity_score, prospect_priority)
    VALUES (?, 'TEST CRM LOGGING SRL', 'ACTIVE', 80.0, 'HIGH')
  `).run(testCui);

  const insertStmt = db.prepare(`
    INSERT INTO crm_interactions (
      cui, interaction_type, outcome, notes, contact_person, next_action, next_follow_up_date, user_responsible
    ) VALUES (?, 'CALL_OUTGOING', 'REACHED_DECISION_MAKER', 'Discutat cu administratorul despre CAR.', 'Popescu Ion', 'Trimitere ofertă', '2026-11-20', 'myremaxclubcristianv@gmail.com')
  `);
  const res = insertStmt.run(testCui);
  assert.ok(res.lastInsertRowid > 0);

  const logged = db.prepare('SELECT * FROM crm_interactions WHERE cui = ?').get(testCui);
  assert.equal(logged.cui, testCui);
  assert.equal(logged.interaction_type, 'CALL_OUTGOING');
  assert.equal(logged.outcome, 'REACHED_DECISION_MAKER');
  assert.equal(logged.user_responsible, 'myremaxclubcristianv@gmail.com');
  assert.equal(logged.contact_person, 'Popescu Ion');

  // Cleanup
  db.prepare('DELETE FROM crm_interactions WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.close();
});

test('CRM Follow-up task management supports scheduling and completion', () => {
  const db = new Database(DB_PATH);
  const testCui = 99999902;
  db.prepare('DELETE FROM crm_follow_ups WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);

  db.prepare(`
    INSERT INTO companies (cui, name, status, opportunity_score)
    VALUES (?, 'TEST FOLLOWUP SRL', 'ACTIVE', 75.0)
  `).run(testCui);

  const taskRes = db.prepare(`
    INSERT INTO crm_follow_ups (cui, title, description, due_date, priority, status, created_by)
    VALUES (?, 'Sunat pentru ofertă', 'Revenire după analiza deviz', '2026-11-18', 'HIGH', 'PENDING', 'myremaxclubcristianv@gmail.com')
  `).run(testCui);

  assert.ok(taskRes.lastInsertRowid > 0);

  // Mark complete
  db.prepare(`
    UPDATE crm_follow_ups 
    SET status = 'COMPLETED', completed_at = datetime('now'), completed_by = 'myremaxclubcristianv@gmail.com'
    WHERE id = ?
  `).run(taskRes.lastInsertRowid);

  const completed = db.prepare('SELECT * FROM crm_follow_ups WHERE id = ?').get(taskRes.lastInsertRowid);
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.completed_by, 'myremaxclubcristianv@gmail.com');
  assert.ok(completed.completed_at !== null);

  // Cleanup
  db.prepare('DELETE FROM crm_follow_ups WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.close();
});

test('CRM Status History preserves stage transitions audit trail', () => {
  const db = new Database(DB_PATH);
  const testCui = 99999903;
  db.prepare('DELETE FROM crm_status_history WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);

  db.prepare(`
    INSERT INTO companies (cui, name, status)
    VALUES (?, 'TEST STAGE HISTORY SRL', 'ACTIVE')
  `).run(testCui);

  db.prepare(`
    INSERT INTO crm_status_history (cui, old_status, new_status, reason, changed_by)
    VALUES (?, 'NEW', 'IN_DISCUSSION', 'Contactat telefonic, interesat de asigurare', 'myremaxclubcristianv@gmail.com')
  `).run(testCui);

  const hist = db.prepare('SELECT * FROM crm_status_history WHERE cui = ?').get(testCui);
  assert.equal(hist.cui, testCui);
  assert.equal(hist.old_status, 'NEW');
  assert.equal(hist.new_status, 'IN_DISCUSSION');
  assert.equal(hist.changed_by, 'myremaxclubcristianv@gmail.com');

  // Cleanup
  db.prepare('DELETE FROM crm_status_history WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.close();
});

test('Contact records enforce strict verification classification and provenance', () => {
  const db = new Database(DB_PATH);
  const testCui = 99999904;
  db.prepare('DELETE FROM contact_records WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);

  db.prepare(`
    INSERT INTO companies (cui, name, status)
    VALUES (?, 'TEST CONTACT PROVENANCE SRL', 'ACTIVE')
  `).run(testCui);

  db.prepare(`
    INSERT INTO contact_records (
      cui, contact_type, contact_value, normalized_value, label,
      source_name, provenance_url, verification_method, verification_status,
      confidence_score, contact_person, contact_person_position
    ) VALUES (
      ?, 'MOBILE', '0722123456', '+40722123456', 'DIRECTOR',
      'ANAF_DECLARAT', 'https://webservicesp.anaf.ro', 'ANAF_TVA_REST', 'DECLARED_PUBLIC_REGISTER',
      0.90, 'Ionescu Radu', 'Administrator'
    )
  `).run(testCui);

  const c = db.prepare('SELECT * FROM contact_records WHERE cui = ?').get(testCui);
  assert.equal(c.normalized_value, '+40722123456');
  assert.equal(c.source_name, 'ANAF_DECLARAT');
  assert.equal(c.verification_status, 'DECLARED_PUBLIC_REGISTER');
  assert.equal(c.contact_person, 'Ionescu Radu');
  assert.equal(c.contact_person_position, 'Administrator');

  // Cleanup
  db.prepare('DELETE FROM contact_records WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.close();
});

test('Calling workflow transitions CRM stage, preserves source provenance and supports manual verification', () => {
  const db = new Database(DB_PATH);
  const testCui = 99999905;
  const testPhone = '0733999888';

  // Setup
  db.prepare('DELETE FROM crm_interactions WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM crm_follow_ups WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM prospect_pipeline WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM contact_records WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM suppression_list WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);

  db.prepare(`
    INSERT INTO companies (cui, name, status, opportunity_score, primary_caen)
    VALUES (?, 'TEST CALLING WORKFLOW SRL', 'ACTIVE', 85.0, '4941')
  `).run(testCui);

  db.prepare(`
    INSERT INTO prospect_pipeline (cui, status) VALUES (?, 'NEW')
  `).run(testCui);

  db.prepare(`
    INSERT INTO contact_records (
      cui, contact_type, contact_value, normalized_value, source_name, provenance_url, verification_status, confidence_score
    ) VALUES (
      ?, 'MOBILE', ?, '+40733999888', 'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'DECLARED_BY_COMPANY', 0.85
    )
  `).run(testCui, testPhone);

  // 1. Simulate Registering Call Outcome: DECISION_MAKER_IDENTIFIED with manual verification
  db.prepare(`
    INSERT INTO crm_interactions (
      cui, interaction_type, outcome, notes, contact_person, contact_value, next_action, next_follow_up_date, user_responsible
    ) VALUES (?, 'CALL_OUTGOING', 'DECISION_MAKER_IDENTIFIED', 'Discutat cu dl. Popescu (Director Transport). Interesat de cotație CMR flotă.', 'Popescu Vasile (Director Transport)', ?, 'Trimis ofertă preliminară CMR', '2026-11-20', 'myremaxclubcristianv@gmail.com')
  `).run(testCui, testPhone);

  // Update pipeline status
  db.prepare(`UPDATE prospect_pipeline SET status = 'CONTACTED', updated_at = datetime('now') WHERE cui = ?`).run(testCui);

  // Verify contact manually
  db.prepare(`
    UPDATE contact_records 
    SET verification_status = 'MANUALLY_CONFIRMED', confidence_score = 1.0, last_checked_at = datetime('now'),
        notes = 'Confirmat activ telefonic de administrator'
    WHERE cui = ? AND contact_value = ?
  `).run(testCui, testPhone);

  // Assertions
  const pipeline = db.prepare('SELECT status FROM prospect_pipeline WHERE cui = ?').get(testCui);
  assert.equal(pipeline.status, 'CONTACTED');

  const contact = db.prepare('SELECT * FROM contact_records WHERE cui = ?').get(testCui);
  assert.equal(contact.verification_status, 'MANUALLY_CONFIRMED');
  assert.equal(contact.confidence_score, 1.0);
  assert.equal(contact.source_name, 'ANAF_OPEN_DATA', 'Original source must be preserved');
  assert.equal(contact.provenance_url, 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'Original provenance URL must be preserved');

  // 2. Simulate Follow-up call: DO_NOT_CONTACT
  db.prepare(`
    INSERT INTO crm_interactions (
      cui, interaction_type, outcome, notes, contact_value, user_responsible
    ) VALUES (?, 'CALL_OUTGOING', 'DO_NOT_CONTACT', 'Firma a cerut expres radierea din campanii', ?, 'myremaxclubcristianv@gmail.com')
  `).run(testCui, testPhone);

  db.prepare(`UPDATE prospect_pipeline SET status = 'DO_NOT_CONTACT' WHERE cui = ?`).run(testCui);
  db.prepare(`INSERT INTO suppression_list (cui, phone, reason) VALUES (?, ?, 'DO_NOT_CONTACT solicitat')`).run(testCui, testPhone);

  const suppression = db.prepare('SELECT * FROM suppression_list WHERE cui = ?').get(testCui);
  assert.ok(suppression);
  assert.equal(suppression.phone, testPhone);

  // Cleanup
  db.prepare('DELETE FROM crm_interactions WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM crm_follow_ups WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM prospect_pipeline WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM contact_records WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM suppression_list WHERE cui = ?').run(testCui);
  db.prepare('DELETE FROM companies WHERE cui = ?').run(testCui);
  db.close();
});

test('Production database reconciles exactly to canonical figures', () => {
  const db = new Database(DB_PATH);
  
  const totalCompanies = db.prepare('SELECT count(*) as count FROM companies').get().count;
  assert.equal(totalCompanies, 2908, 'Must have exactly 2,908 companies');

  const contactCos = db.prepare('SELECT count(distinct cui) as count FROM contact_records').get().count;
  assert.equal(contactCos, 1504, 'Must have exactly 1,504 distinct companies with contact records');

  const totalContacts = db.prepare('SELECT count(*) as count FROM contact_records').get().count;
  assert.equal(totalContacts, 1564, 'Must have exactly 1,564 contact records');

  const mobileCos = db.prepare("SELECT count(distinct cui) as count FROM contact_records WHERE contact_type = 'MOBILE'").get().count;
  assert.equal(mobileCos, 1121, 'Must have exactly 1,121 distinct companies with mobile numbers');

  const landlineCos = db.prepare("SELECT count(distinct cui) as count FROM contact_records WHERE contact_type = 'LANDLINE'").get().count;
  assert.equal(landlineCos, 402, 'Must have exactly 402 distinct companies with landlines');

  const emailCos = db.prepare("SELECT count(distinct cui) as count FROM contact_records WHERE contact_type = 'EMAIL'").get().count;
  assert.equal(emailCos, 3, 'Must have exactly 3 companies with email');

  const websiteCos = db.prepare("SELECT count(distinct cui) as count FROM contact_records WHERE contact_type = 'WEBSITE'").get().count;
  assert.equal(websiteCos, 9, 'Must have exactly 9 companies with website');

  const anafRecords = db.prepare("SELECT count(*) as count FROM contact_records WHERE source_name = 'ANAF_OPEN_DATA'").get().count;
  assert.equal(anafRecords, 1546, 'Must have exactly 1,546 ANAF contact records');

  db.close();
});
