const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('fs');
const { NationalSearchEngine, LocalShardsDriver } = require('../scripts/national-engine');

const V2_DIR = path.join(__dirname, '..', 'data', 'national_shards_v2');
const SPECIAL_INDEX_PATH = path.join(V2_DIR, 'shards', 'names', 'prefix-special.json');

// The exact 32 canonical records with leading non-alphanumeric characters
const SPECIAL_32_RECORDS = [
  { cui: 29678, name: '" LA TASSE " IMPEX SRL', querySample: 'LA TASSE', exactQuery: '" LA TASSE "' },
  { cui: 643391, name: '$ MERCUR SRL', querySample: 'MERCUR', exactQuery: '$ MERCUR' },
  { cui: 809703, name: '+ 2 COMEXIM SRL', querySample: '+ 2 COMEXIM', exactQuery: '+ 2 COMEXIM SRL' },
  { cui: 1315864, name: '& ALBULESCU S.R.L.', querySample: 'ALBULESCU', exactQuery: '& ALBULESCU' },
  { cui: 4928286, name: '$ G M COMIMPEX SRL', querySample: 'G M COMIMPEX', exactQuery: '$ G M' },
  { cui: 7103992, name: '& ION SI IONUT IMPEX SRL', querySample: 'ION SI IONUT', exactQuery: '& ION SI IONUT' },
  { cui: 9198220, name: "' 97 ANTONIU & CO. COMEXIM SRL", querySample: 'ANTONIU', exactQuery: "' 97 ANTONIU" },
  { cui: 9225139, name: '<< Z >> PROD SERV COM SRL', querySample: '<< Z >>', exactQuery: '<< Z >> PROD' },
  { cui: 9548385, name: '" REX " SRL COCORA IALOMITA SUCURSALA BUCURESTI', querySample: 'REX', exactQuery: '" REX "' },
  { cui: 9738592, name: '... ESCU 2000 COM IMPEX SRL', querySample: 'ESCU 2000', exactQuery: '... ESCU' },
  { cui: 9773743, name: '" TEOCONF " SRL', querySample: 'TEOCONF', exactQuery: '" TEOCONF "' },
  { cui: 14715196, name: '" Y A M " INTERNATIONAL FREIGHT & SHIPPING SRL', querySample: 'INTERNATIONAL FREIGHT', exactQuery: '" Y A M "' },
  { cui: 15764227, name: '+ TELECOM NETWORK SRL', querySample: 'TELECOM NETWORK', exactQuery: '+ TELECOM' },
  { cui: 16409444, name: '+ CONCEPT BV SRL', querySample: 'CONCEPT BV', exactQuery: '+ CONCEPT' },
  { cui: 16544505, name: '@ DENIM INTERNATIONAL SRL', querySample: 'DENIM INTERNATIONAL', exactQuery: '@ DENIM' },
  { cui: 17212920, name: '" SmArt Tree " Grup SRL', querySample: 'Smart Tree', exactQuery: '" SmArt Tree "' },
  { cui: 17274221, name: "''AS'' CONSTRUCT MARTIN SRL", querySample: 'CONSTRUCT MARTIN', exactQuery: "''AS''" },
  { cui: 18477135, name: '... BY ANDA ADAM SRL', querySample: 'ANDA ADAM', exactQuery: '... BY ANDA ADAM' },
  { cui: 22043002, name: "' 91 UBA SRL", querySample: '91 UBA', exactQuery: "' 91 UBA" },
  { cui: 22724420, name: '" CARDIOFORCE " SRL', querySample: 'CARDIOFORCE', exactQuery: '" CARDIOFORCE "' },
  { cui: 26419437, name: "''VIN'' LA LEU SRL", querySample: 'VIN LA LEU', exactQuery: "''VIN''" },
  { cui: 27097100, name: "''CRESCĂTOR'' POPESCU ALEXANDRU PERSOANĂ FIZICĂ AUTORIZATĂ", querySample: 'CRESCATOR', exactQuery: "''CRESCĂTOR''" },
  { cui: 27594967, name: '" VIN LA SORIN " SRL', querySample: 'VIN LA SORIN', exactQuery: '" VIN LA SORIN "' },
  { cui: 31588807, name: ',,ISIK 2011" EOOD PLOVDIV-SUCURSALA BUCURESTI', querySample: 'ISIK 2011', exactQuery: ',,ISIK 2011"' },
  { cui: 34256110, name: '" INOVAŢIE" CENTRUL DE CONSULTAŢII ÎN AFACERI CU UCRAINA SRL', querySample: 'INOVATIE', exactQuery: '" INOVAŢIE"' },
  { cui: 35903729, name: "'' ELECTRO STYLE '' O.O.D. Sofia - Sucursala Bucuresti", querySample: 'ELECTRO STYLE', exactQuery: "'' ELECTRO STYLE ''" },
  { cui: 38097157, name: "''THE VINTAGE ROSE'' EVENIMENTS AND MORE SRL", querySample: 'VINTAGE ROSE', exactQuery: "''THE VINTAGE ROSE''" },
  { cui: 38754915, name: ',,AEP TICKETING SOLUTIONS S.R.L., Signa, Italia - sucursala Bucuresti"', querySample: 'TICKETING SOLUTIONS', exactQuery: ',,AEP TICKETING' },
  { cui: 40625777, name: "'''BAUSTELLE-SIEBENBÜRGEN'' S.R.L.", querySample: 'BAUSTELLE', exactQuery: "'''BAUSTELLE" },
  { cui: 40854240, name: ',,SATUL NOU" COOPERATIVA AGRICOLĂ', querySample: 'SATUL NOU', exactQuery: ',,SATUL NOU"' },
  { cui: 50098186, name: ': VELO-M.-T.-B. & SNOWBOARD-SOLUTIONS S.R.L.', querySample: 'VELO-M.-T.-B', exactQuery: ': VELO' },
  { cui: 53872183, name: "''BUTICU LU' NICU'' S.R.L.", querySample: 'BUTICU LU NICU', exactQuery: "''BUTICU" },
];

test('1. Special Name Index Shard — prefix-special.json exists and holds exactly 32 records', () => {
  assert.ok(fs.existsSync(SPECIAL_INDEX_PATH), 'prefix-special.json must exist');
  const items = JSON.parse(fs.readFileSync(SPECIAL_INDEX_PATH, 'utf8'));
  assert.strictEqual(items.length, 32, 'Must contain exactly 32 exceptional records');

  // Verify size is well within limits (< 10 KB, vast margin below 4 MB)
  const stat = fs.statSync(SPECIAL_INDEX_PATH);
  assert.ok(stat.size < 10 * 1024, `Size must be < 10 KB, was ${stat.size} bytes`);

  // Verify all 32 CUIs match the exact canonical list
  const storedCuis = new Set(items.map((i) => i.cui));
  for (const rec of SPECIAL_32_RECORDS) {
    assert.ok(storedCuis.has(rec.cui), `CUI ${rec.cui} (${rec.name}) must be in prefix-special.json`);
  }
});

test('2. CUI Profile Fetcher Discoverability — All 32 exceptional records discoverable by CUI', async () => {
  const driver = new LocalShardsDriver(V2_DIR);
  for (const rec of SPECIAL_32_RECORDS) {
    const profile = await NationalSearchEngine.getByCui(rec.cui, driver);
    assert.ok(profile, `Profile for CUI ${rec.cui} must be found`);
    assert.strictEqual(profile.cui, rec.cui);
    assert.strictEqual(profile.name, rec.name, 'Canonical name must be preserved exactly');
  }
});

test('3. Exact-Name Search Discoverability — All 32 records discoverable by exact/leading-symbol query', async () => {
  const driver = new LocalShardsDriver(V2_DIR);
  for (const rec of SPECIAL_32_RECORDS) {
    const res = await NationalSearchEngine.search({ q: rec.exactQuery }, driver);
    const found = res.items.some((i) => i.cui === rec.cui);
    assert.ok(found, `Must find company ${rec.name} using query '${rec.exactQuery}'`);
  }
});

test('4. Partial-Name Search Discoverability — All 32 records discoverable by alphanumeric token', async () => {
  const driver = new LocalShardsDriver(V2_DIR);
  for (const rec of SPECIAL_32_RECORDS) {
    const res = await NationalSearchEngine.search({ q: rec.querySample }, driver);
    const found = res.items.some((i) => i.cui === rec.cui);
    assert.ok(found, `Must find company ${rec.name} using token '${rec.querySample}'`);
  }
});

test('5. Diacritic Insensitive Matching — Diacritic variations find the exact Romanian entity', async () => {
  const driver = new LocalShardsDriver(V2_DIR);

  // Search with diacritic: "CRESCĂTOR"
  const resWith = await NationalSearchEngine.search({ q: 'CRESCĂTOR' }, driver);
  assert.ok(resWith.items.some((i) => i.cui === 27097100));

  // Search without diacritic: "CRESCATOR"
  const resWithout = await NationalSearchEngine.search({ q: 'CRESCATOR' }, driver);
  assert.ok(resWithout.items.some((i) => i.cui === 27097100));

  // Search INOVAŢIE / INOVATIE
  const resInovWith = await NationalSearchEngine.search({ q: 'INOVAŢIE' }, driver);
  assert.ok(resInovWith.items.some((i) => i.cui === 34256110));
  const resInovWithout = await NationalSearchEngine.search({ q: 'INOVATIE' }, driver);
  assert.ok(resInovWithout.items.some((i) => i.cui === 34256110));
});
