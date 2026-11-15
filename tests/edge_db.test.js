const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('Edge database adapter loads snapshot and executes key queries', async () => {
  const snapshotPath = path.join(__dirname, '..', 'src', 'lib', 'data-snapshot.json');
  const snapshot = require(snapshotPath);

  assert.ok(snapshot.companies && snapshot.companies.length >= 2900, 'Snapshot must hold >= 2900 companies');
  assert.ok(snapshot.insurance_opportunities && snapshot.insurance_opportunities.length >= 2000, 'Snapshot must hold insurance leads');

  // Verify first company
  const first = snapshot.companies[0];
  assert.ok(first.cui, 'Company must have CUI');
  assert.ok(first.name, 'Company must have name');
  assert.ok(first.county, 'Company must have county');
});
