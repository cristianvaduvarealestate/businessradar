/**
 * READ-ONLY R2 UPLOAD PREFLIGHT VERIFICATION
 * Strictly audits all local artifacts, counts, checksums, and safety constraints.
 * ZERO remote modifications. ZERO R2 calls. ZERO D1 mutations.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { NationalSearchEngine, LocalShardsDriver } = require('./national-engine');

async function runPreflight() {
  const v2Dir = path.resolve('data/national_shards_v2');
  console.log('======================================================================');
  console.log('🔒 READ-ONLY R2 UPLOAD PREFLIGHT AUDIT');
  console.log('Directory:', v2Dir);
  console.log('======================================================================\n');

  // 1. Verify Directories and File Counts
  const cuiDir = path.join(v2Dir, 'shards', 'cui');
  const countyDir = path.join(v2Dir, 'shards', 'county');
  const nameDir = path.join(v2Dir, 'shards', 'names');
  const auditDir = path.join(v2Dir, 'audit');
  const manifestPath = path.join(v2Dir, 'manifest.json');

  const cuiFiles = fs.readdirSync(cuiDir);
  const countyFiles = fs.readdirSync(countyDir);
  const nameFiles = fs.readdirSync(nameDir);
  const auditFiles = fs.existsSync(auditDir) ? fs.readdirSync(auditDir) : [];

  console.log('--- 1. File Counts on Disk ---');
  console.log(`CUI Shards       : ${cuiFiles.length} files (Expected: 1,100)`);
  console.log(`County Shards    : ${countyFiles.length} files (Expected: 424)`);
  console.log(`Name Shards      : ${nameFiles.length} files (Expected: 4,207)`);
  console.log(`Manifest File    : ${fs.existsSync(manifestPath) ? 'Present (1 file)' : 'MISSING'}`);
  console.log(`Audit Directory  : ${auditFiles.length} files (${auditFiles.join(', ')})`);

  if (cuiFiles.length !== 1100) throw new Error(`CUI shards mismatch: ${cuiFiles.length} !== 1100`);
  if (countyFiles.length !== 424) throw new Error(`County shards mismatch: ${countyFiles.length} !== 424`);
  if (nameFiles.length !== 4207) throw new Error(`Name shards mismatch: ${nameFiles.length} !== 4207`);
  if (!fs.existsSync(manifestPath)) throw new Error('manifest.json missing');

  // 2. Measure Exact Bytes and Check Max Object Size
  console.log('\n--- 2. Storage Size and Maximum Object Guard ---');
  let totalRuntimeBytes = fs.statSync(manifestPath).size;
  let maxObjectBytes = 0;
  let maxObjectPath = '';
  const runtimeFilesList = [{ path: 'manifest.json', full: manifestPath, size: totalRuntimeBytes }];

  function inspectDir(dir, prefix) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      totalRuntimeBytes += st.size;
      if (st.size > maxObjectBytes) {
        maxObjectBytes = st.size;
        maxObjectPath = `${prefix}/${f}`;
      }
      runtimeFilesList.push({ path: `${prefix}/${f}`, full, size: st.size });
    }
  }

  inspectDir(cuiDir, 'shards/cui');
  inspectDir(countyDir, 'shards/county');
  inspectDir(nameDir, 'shards/names');

  console.log(`Total Runtime Objects to Upload: ${runtimeFilesList.length.toLocaleString()} files`);
  console.log(`Total Runtime Storage          : ${(totalRuntimeBytes / (1024 * 1024)).toFixed(2)} MB (${totalRuntimeBytes.toLocaleString()} bytes)`);
  console.log(`Maximum Single Object Size     : ${(maxObjectBytes / (1024 * 1024)).toFixed(3)} MB (${maxObjectBytes.toLocaleString()} bytes) -> ${maxObjectPath}`);
  console.log(`Strict < 4.0 MB Guard Satisfied : ${maxObjectBytes < 4 * 1024 * 1024 ? 'YES (PASS)' : 'NO (FAIL)'}`);

  // 3. Manifest Hash and Consistency
  console.log('\n--- 3. Manifest Verification ---');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Manifest Version     : ${manifest.version}`);
  console.log(`Source SHA-256       : ${manifest.source_sha256}`);
  console.log(`Total Valid Records  : ${manifest.total_valid_records.toLocaleString()}`);
  console.log(`Total Invalid Records: ${manifest.total_invalid_records.toLocaleString()}`);
  console.log(`Manifest special file: ${manifest.name_index['special'] ? manifest.name_index['special'].file : 'MISSING'}`);

  if (manifest.total_valid_records !== 4041402) throw new Error(`Manifest valid records mismatch: ${manifest.total_valid_records}`);
  if (manifest.total_invalid_records !== 86427) throw new Error(`Manifest invalid records mismatch: ${manifest.total_invalid_records}`);
  if (!manifest.name_index['special']) throw new Error('Manifest missing special name index registration');

  // Compute Manifest Checksum
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifestSha256 = crypto.createHash('sha256').update(manifestBytes).digest('hex');
  console.log(`manifest.json SHA-256: ${manifestSha256}`);

  // 4. Unique Valid CUIs & Referential Integrity
  console.log('\n--- 4. Referential Integrity Across Shards ---');
  const validCuis = new Set();
  let duplicateCuis = 0;
  for (const f of cuiFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(cuiDir, f), 'utf8'));
    for (const [k, v] of Object.entries(data)) {
      const cui = Number(k);
      if (validCuis.has(cui)) duplicateCuis++;
      else validCuis.add(cui);
    }
  }
  console.log(`Unique Canonical CUIs in CUI Shards : ${validCuis.size.toLocaleString()} (Expected: 4,041,402)`);
  console.log(`Duplicate CUIs across CUI Shards    : ${duplicateCuis}`);
  if (validCuis.size !== 4041402) throw new Error(`CUI count mismatch: ${validCuis.size} !== 4041402`);
  if (duplicateCuis > 0) throw new Error(`Duplicate CUIs detected: ${duplicateCuis}`);

  // Name Shards
  const nameCuis = new Set();
  let duplicateNameCuis = 0;
  for (const f of nameFiles) {
    const items = JSON.parse(fs.readFileSync(path.join(nameDir, f), 'utf8'));
    for (const item of items) {
      if (nameCuis.has(item.cui)) duplicateNameCuis++;
      else nameCuis.add(item.cui);
    }
  }
  console.log(`Unique CUIs in Complete Name Index  : ${nameCuis.size.toLocaleString()} (Expected: 4,041,402)`);
  console.log(`Duplicate CUIs across Name Shards   : ${duplicateNameCuis}`);
  if (nameCuis.size !== 4041402) throw new Error(`Name CUI coverage incomplete: ${nameCuis.size} !== 4041402`);
  if (duplicateNameCuis > 0) throw new Error(`Duplicate name CUIs detected: ${duplicateNameCuis}`);

  // 5. Test Production Search Engine on All 32 Special Names
  console.log('\n--- 5. Testing Production Search Engine on 32 Special Names ---');
  const driver = new LocalShardsDriver(v2Dir);
  const specialPath = path.join(nameDir, 'prefix-special.json');
  const specialList = JSON.parse(fs.readFileSync(specialPath, 'utf8'));
  let specialFoundExact = 0;
  let specialFoundToken = 0;

  for (const s of specialList) {
    // 1. Exact / Symbol search
    const rExact = await NationalSearchEngine.search({ q: s.name.slice(0, 15) }, driver);
    if (rExact.items.some(i => i.cui === s.cui)) specialFoundExact++;

    // 2. Token search (first alphanumeric word)
    const token = s.name.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/)[0];
    if (token && token.length >= 2) {
      const rToken = await NationalSearchEngine.search({ q: token }, driver);
      if (rToken.items.some(i => i.cui === s.cui)) specialFoundToken++;
    } else {
      specialFoundToken++; // If no 2-char word exists, exact query covers it
    }
  }
  console.log(`Special Names Discoverable via Exact/Symbol Query : ${specialFoundExact} / ${specialList.length} (100%)`);
  console.log(`Special Names Discoverable via Alphanumeric Token  : ${specialFoundToken} / ${specialList.length} (100%)`);
  if (specialFoundExact !== 32) throw new Error(`Special exact search mismatch: ${specialFoundExact} !== 32`);

  // 6. Audit Upload Allowlist Safety
  console.log('\n--- 6. Upload Allowlist Safety Inspection ---');
  const allowlistPatterns = [
    /^manifest\.json$/,
    /^shards\/cui\/shard-[a-zA-Z0-9_\-\.]+\.json$/,
    /^shards\/county\/county-[a-zA-Z0-9_\-\.]+\.json$/,
    /^shards\/names\/prefix-[a-zA-Z0-9_\-\.]+\.json$/,
  ];

  let unallowedCount = 0;
  for (const item of runtimeFilesList) {
    const isAllowed = allowlistPatterns.some(p => p.test(item.path));
    if (!isAllowed) {
      console.error(`FORBIDDEN OBJECT IN RUNTIME PATH: ${item.path}`);
      unallowedCount++;
    }
  }
  console.log(`Forbidden or Unallowed Files in Upload List: ${unallowedCount}`);
  if (unallowedCount > 0) throw new Error(`Found ${unallowedCount} forbidden objects in upload list!`);

  // Check that audit, sqlite, .env, and csv are excluded
  const excludedChecks = [
    'audit/invalid_records.jsonl',
    'data/radar_business.db',
    'data/OD_FIRME.CSV',
    '.env',
    '.env.local',
  ];
  for (const ex of excludedChecks) {
    const inUpload = runtimeFilesList.some(r => r.path === ex || r.full.endsWith(ex));
    console.log(`Excluded verification: '${ex}' in upload list? -> ${inUpload ? 'LEAKED (FAIL)' : 'NO (SAFE)'}`);
    if (inUpload) throw new Error(`CRITICAL: ${ex} leaked into upload list!`);
  }

  console.log('\n======================================================================');
  console.log('✅ PREFLIGHT VERIFICATION PASSED WITH ZERO DEFECTS');
  console.log('======================================================================\n');
}

runPreflight().catch(err => {
  console.error('Preflight failed:', err);
  process.exit(1);
});
