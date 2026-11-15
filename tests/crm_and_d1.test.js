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
