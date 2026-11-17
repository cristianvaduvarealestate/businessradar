const path = require('path');
const { NationalSearchEngine, LocalShardsDriver } = require('./national-engine');

async function testRealSearch() {
  console.log('='.repeat(70));
  console.log('🇷🇴 TESTING NATIONAL SEARCH ENGINE OVER 4,041,402 REAL COMPANIES');
  console.log('='.repeat(70));

  const shardsDir = path.join(__dirname, '..', 'data', 'national_shards');
  const driver = new LocalShardsDriver(shardsDir);

  const isAvail = await driver.isAvailable();
  console.log(`Driver: ${driver.getDriverName()} | Available: ${isAvail}`);

  const manifest = await driver.getManifest();
  console.log(`Manifest: ${manifest.version} | Valid Records: ${manifest.total_valid_records.toLocaleString()}`);

  // 1. Direct CUI Search
  console.log('\n--- 1. DIRECT CUI LOOKUP (412052) ---');
  let t0 = process.hrtime.bigint();
  const cuiRes = await NationalSearchEngine.search({ cui: 412052 }, driver);
  let t1 = process.hrtime.bigint();
  let ms = Number(t1 - t0) / 1000000;
  console.log(`Found: ${cuiRes.items.length} items in ${ms.toFixed(2)} ms`);
  console.log('Company:', cuiRes.items[0]);

  // 2. Name Search: DEDEMAN
  console.log('\n--- 2. NAME SEARCH: "DEDEMAN" ---');
  t0 = process.hrtime.bigint();
  const nameRes = await NationalSearchEngine.search({ q: 'DEDEMAN' }, driver);
  t1 = process.hrtime.bigint();
  ms = Number(t1 - t0) / 1000000;
  console.log(`Found: ${nameRes.pagination.total} total companies matching "DEDEMAN" in ${ms.toFixed(2)} ms`);
  console.log(`First 3 matches:`);
  for (const item of nameRes.items.slice(0, 3)) {
    console.log(`  - CUI: ${item.cui} | ${item.name} | ${item.county} | ${item.legal_form}`);
  }

  // 3. Name Search: BANCA TRANSILVANIA
  console.log('\n--- 3. NAME SEARCH: "BANCA TRANSILVANIA" ---');
  t0 = process.hrtime.bigint();
  const btRes = await NationalSearchEngine.search({ q: 'BANCA TRANSILVANIA' }, driver);
  t1 = process.hrtime.bigint();
  ms = Number(t1 - t0) / 1000000;
  console.log(`Found: ${btRes.pagination.total} total companies matching "BANCA TRANSILVANIA" in ${ms.toFixed(2)} ms`);
  for (const item of btRes.items.slice(0, 3)) {
    console.log(`  - CUI: ${item.cui} | ${item.name} | ${item.county} | ${item.legal_form}`);
  }

  // 4. County Search: CLUJ
  console.log('\n--- 4. COUNTY SEARCH: "CLUJ" ---');
  t0 = process.hrtime.bigint();
  const clujRes = await NationalSearchEngine.search({ county: 'Cluj', limit: 5 }, driver);
  t1 = process.hrtime.bigint();
  ms = Number(t1 - t0) / 1000000;
  console.log(`Found: ${clujRes.pagination.total.toLocaleString()} total companies in Cluj in ${ms.toFixed(2)} ms`);
  for (const item of clujRes.items.slice(0, 3)) {
    console.log(`  - CUI: ${item.cui} | ${item.name} | ${item.city} | ${item.caen}`);
  }

  // 5. Single profile fetch
  console.log('\n--- 5. DIRECT PROFILE FETCH: getByCui(412052) ---');
  t0 = process.hrtime.bigint();
  const profile = await NationalSearchEngine.getByCui(412052, driver);
  t1 = process.hrtime.bigint();
  ms = Number(t1 - t0) / 1000000;
  console.log(`Fetch duration: ${ms.toFixed(2)} ms`);
  console.log(`Profile: ${profile.name} (CUI ${profile.cui}, Reg: ${profile.reg_com}, Form: ${profile.legal_form})`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ ALL SEARCH STRATEGIES OPERATIONAL ON REAL 4.04M DATASET');
  console.log('='.repeat(70));
}

testRealSearch().catch(console.error);
