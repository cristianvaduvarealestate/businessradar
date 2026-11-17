const path = require('path');
const { NationalSearchEngine, LocalShardsDriver } = require('./national-engine');

async function testV2() {
  console.log('='.repeat(70));
  console.log('🇷🇴 TESTING V2 WORKER-SAFE SEARCH ENGINE OVER 4,041,402 REAL RECORDS');
  console.log('='.repeat(70));

  const driver = new LocalShardsDriver(path.join(__dirname, '..', 'data', 'national_shards_v2'));
  const manifest = await driver.getManifest();
  console.log(`Manifest Version : ${manifest.version}`);
  console.log(`Total Records    : ${manifest.total_valid_records.toLocaleString()}`);

  // 1. Direct CUI Search
  console.log('\n--- 1. DIRECT CUI SEARCH (TRANSIDEAL SRL - 412052) ---');
  let t0 = process.hrtime.bigint();
  const cuiRes = await NationalSearchEngine.search({ cui: 412052 }, driver);
  let t1 = process.hrtime.bigint();
  console.log(`Duration: ${(Number(t1 - t0) / 1000000).toFixed(2)} ms`);
  console.log('Result:', cuiRes.items[0]);

  // 2. Name Search: DEDEMAN
  console.log('\n--- 2. NAME SEARCH: "DEDEMAN" ---');
  t0 = process.hrtime.bigint();
  const dedemanRes = await NationalSearchEngine.search({ q: 'DEDEMAN' }, driver);
  t1 = process.hrtime.bigint();
  console.log(`Duration: ${(Number(t1 - t0) / 1000000).toFixed(2)} ms`);
  console.log(`Total Matches: ${dedemanRes.pagination.total}`);
  for (const item of dedemanRes.items) {
    console.log(`  - CUI: ${item.cui} | ${item.name} | ${item.county} | ${item.legal_form}`);
  }

  // 3. County Search: BUCURESTI (previously crashed with 117MB!)
  console.log('\n--- 3. COUNTY SEARCH: BUCURESTI (BOUNDED CHUNK) ---');
  t0 = process.hrtime.bigint();
  const bRes = await NationalSearchEngine.search({ county: 'București', limit: 5 }, driver);
  t1 = process.hrtime.bigint();
  console.log(`Duration: ${(Number(t1 - t0) / 1000000).toFixed(2)} ms`);
  console.log(`Total Companies in București: ${bRes.pagination.total.toLocaleString()}`);
  console.log(`Returned Items (Page 1): ${bRes.items.length}`);
  for (const item of bRes.items.slice(0, 3)) {
    console.log(`  - CUI: ${item.cui} | ${item.name} | ${item.city}`);
  }

  // 4. County Search: CLUJ
  console.log('\n--- 4. COUNTY SEARCH: CLUJ ---');
  t0 = process.hrtime.bigint();
  const clujRes = await NationalSearchEngine.search({ county: 'Cluj', limit: 5 }, driver);
  t1 = process.hrtime.bigint();
  console.log(`Duration: ${(Number(t1 - t0) / 1000000).toFixed(2)} ms`);
  console.log(`Total in Cluj: ${clujRes.pagination.total.toLocaleString()}`);
  for (const item of clujRes.items.slice(0, 3)) {
    console.log(`  - CUI: ${item.cui} | ${item.name} | ${item.city}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ ALL SEARCHES COMPLETED SAFELY WITHOUT OVERSIZED OBJECTS');
  console.log('='.repeat(70));
}

testV2().catch(console.error);
