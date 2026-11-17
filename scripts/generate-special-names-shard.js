/**
 * SPECIAL NAMES INDEX SHARD GENERATOR
 * Generates `shards/names/prefix-special.json` for companies with non-alphanumeric leading characters.
 * Ensures 100% of 4,041,402 canonical records are present in the name-search system.
 */

const fs = require('fs');
const path = require('path');

const v2Dir = path.resolve('data/national_shards_v2');
const cuiDir = path.join(v2Dir, 'shards', 'cui');
const nameDir = path.join(v2Dir, 'shards', 'names');
const manifestPath = path.join(v2Dir, 'manifest.json');

// 1. Identify all CUIs in existing name prefix files
console.log('Scanning existing name shards...');
const existingNameCuis = new Set();
const nameFiles = fs.readdirSync(nameDir).filter(f => f.startsWith('prefix-') && f !== 'prefix-special.json');

for (const file of nameFiles) {
  const items = JSON.parse(fs.readFileSync(path.join(nameDir, file), 'utf8'));
  for (const item of items) {
    existingNameCuis.add(item.cui);
  }
}
console.log(`Found ${existingNameCuis.size.toLocaleString()} unique CUIs in ${nameFiles.length} standard name prefix shards.`);

// 2. Scan all CUI shards to find records not in existing name index
console.log('Scanning CUI shards for missing records...');
const cuiFiles = fs.readdirSync(cuiDir);
const specialItems = [];

for (const file of cuiFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(cuiDir, file), 'utf8'));
  for (const [k, comp] of Object.entries(data)) {
    if (!existingNameCuis.has(comp.cui)) {
      specialItems.push({
        cui: comp.cui,
        name: comp.name, // Preserves canonical Romanian company name exactly as stored
        county: comp.county || null,
        status: comp.legal_status || 'ACTIVE',
        caen: comp.primary_caen || '7022',
      });
    }
  }
}

// 3. Sort deterministically by CUI
specialItems.sort((a, b) => a.cui - b.cui);
console.log(`Identified exactly ${specialItems.length} exceptional records.`);

// 4. Write prefix-special.json
const specialShardPath = path.join(nameDir, 'prefix-special.json');
const specialJson = JSON.stringify(specialItems, null, 2);
fs.writeFileSync(specialShardPath, specialJson, 'utf8');
const specialStat = fs.statSync(specialShardPath);
console.log(`✅ Saved ${specialShardPath} (${specialStat.size} bytes, ${(specialStat.size / 1024).toFixed(2)} KB).`);

// 5. Update manifest.json
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.name_index['special'] = {
  type: 'exact',
  file: 'prefix-special.json',
  count: specialItems.length,
};

const allNameFiles = fs.readdirSync(nameDir);
manifest.shards.name_files_count = allNameFiles.length;
manifest.shards.total_files_count = manifest.shards.cui_files_count + manifest.shards.county_files_count + allNameFiles.length + 1; // +1 for manifest

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`✅ Updated manifest.json: name_files_count = ${manifest.shards.name_files_count}, total_files_count = ${manifest.shards.total_files_count}.`);
console.log('Special Name Records Summary:');
specialItems.forEach((item, idx) => {
  console.log(`  ${idx + 1}. CUI: ${item.cui.toString().padEnd(10)} | ${item.name} (${item.county || 'Fără județ'})`);
});
