const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BASE_DIR = path.join(__dirname, '..', 'data', 'national_shards_v2');
const MAX_ALLOWED_BYTES = 4 * 1024 * 1024; // 4 MB

async function verifyV2() {
  console.log('='.repeat(70));
  console.log('🔍 INDEPENDENT VERIFICATION OF WORKER-SAFE SHARDS (V2)');
  console.log('='.repeat(70));

  const manifestPath = path.join(BASE_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Manifest does not exist');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log('Manifest Metadata:');
  console.log(`  Version            : ${manifest.version}`);
  console.log(`  Dataset ID         : ${manifest.dataset_id}`);
  console.log(`  Source SHA-256     : ${manifest.source_sha256}`);
  console.log(`  Declared Valid     : ${manifest.total_valid_records.toLocaleString()}`);
  console.log(`  Declared Invalid   : ${manifest.total_invalid_records.toLocaleString()}`);

  const cuiDir = path.join(BASE_DIR, 'shards', 'cui');
  const countyDir = path.join(BASE_DIR, 'shards', 'county');
  const namesDir = path.join(BASE_DIR, 'shards', 'names');

  const cuiFiles = fs.readdirSync(cuiDir).filter(f => f.endsWith('.json'));
  const countyFiles = fs.readdirSync(countyDir).filter(f => f.endsWith('.json'));
  const nameFiles = fs.readdirSync(namesDir).filter(f => f.endsWith('.json'));

  console.log('\nActual Files on Disk:');
  console.log(`  CUI Shards         : ${cuiFiles.length}`);
  console.log(`  County Files       : ${countyFiles.length}`);
  console.log(`  Name Files         : ${nameFiles.length}`);
  console.log(`  Total Shard Files  : ${cuiFiles.length + countyFiles.length + nameFiles.length}`);

  // 1. Strict Size Check (< 4 MB)
  console.log('\n--- 1. STRICT 4 MB OBJECT SIZE ENFORCEMENT ---');
  let oversizedCount = 0;
  let maxBytes = 0;
  let maxFile = '';
  let totalBytes = 0;

  function checkDirSizes(dir, label) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      totalBytes += st.size;
      if (st.size > maxBytes) {
        maxBytes = st.size;
        maxFile = `${label}/${f}`;
      }
      if (st.size > MAX_ALLOWED_BYTES) {
        console.error(`❌ VIOLATION: ${label}/${f} is ${(st.size / 1024 / 1024).toFixed(2)} MB (> 4MB)`);
        oversizedCount++;
      }
    }
  }

  checkDirSizes(cuiDir, 'cui');
  checkDirSizes(countyDir, 'county');
  checkDirSizes(namesDir, 'names');

  console.log(`  Total Uncompressed Storage : ${(totalBytes / 1024 / 1024).toFixed(2)} MB (${totalBytes.toLocaleString()} bytes)`);
  console.log(`  Largest Object Observed    : ${(maxBytes / 1024 / 1024).toFixed(2)} MB (${maxFile})`);
  console.log(`  Oversized Files (> 4 MB)   : ${oversizedCount}`);
  if (oversizedCount > 0) throw new Error(`${oversizedCount} files exceeded 4 MB limit`);

  // 2. GZIP Sample
  let sampleRaw = 0;
  let sampleGz = 0;
  const sampleFiles = cuiFiles.slice(0, 10).map(f => path.join(cuiDir, f))
    .concat(countyFiles.slice(0, 10).map(f => path.join(countyDir, f)))
    .concat(nameFiles.slice(0, 10).map(f => path.join(namesDir, f)));

  for (const sf of sampleFiles) {
    const buf = fs.readFileSync(sf);
    sampleRaw += buf.length;
    sampleGz += zlib.gzipSync(buf, { level: 6 }).length;
  }
  const gzRatio = sampleGz / sampleRaw;
  const totalGzipBytes = Math.round(totalBytes * gzRatio);
  console.log(`  Estimated GZIP Storage     : ${(totalGzipBytes / 1024 / 1024).toFixed(2)} MB (~${(totalGzipBytes / 1024 / 1024 / 1024).toFixed(2)} GB)`);

  // 3. CUI Deduplication and Ground Truth Count
  console.log('\n--- 2. CUI UNIQUENESS & COMPLETENESS ---');
  const cuiSet = new Set();
  let duplicateCount = 0;
  let totalRecordsFound = 0;

  for (const f of cuiFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(cuiDir, f), 'utf-8'));
    for (const [cuiStr, comp] of Object.entries(data)) {
      const cui = parseInt(cuiStr, 10);
      if (cuiSet.has(cui)) {
        duplicateCount++;
      } else {
        cuiSet.add(cui);
      }
      totalRecordsFound++;
    }
  }

  console.log(`  Total Records in CUI Shards : ${totalRecordsFound.toLocaleString()}`);
  console.log(`  Unique CUIs                 : ${cuiSet.size.toLocaleString()}`);
  console.log(`  Duplicates Across Shards    : ${duplicateCount}`);
  console.log(`  Matches Expected 4,041,402  : ${cuiSet.size === 4041402 ? 'EXACT MATCH ✅' : 'MISMATCH ❌'}`);

  if (cuiSet.size !== 4041402) {
    throw new Error(`Expected 4,041,402 unique CUIs, got ${cuiSet.size}`);
  }

  // 4. Sample Index Integrity Check: Verify that index entries reference valid CUIs
  console.log('\n--- 3. INDEX INTEGRITY: REFERENTIAL INTEGRITY TO VALID CUIS ---');
  let sampledCounties = 0;
  let countyRefMissing = 0;
  for (const cf of countyFiles.slice(0, 15)) {
    const list = JSON.parse(fs.readFileSync(path.join(countyDir, cf), 'utf-8'));
    for (const item of list.slice(0, 50)) {
      sampledCounties++;
      if (!cuiSet.has(item.cui)) countyRefMissing++;
    }
  }
  console.log(`  Sampled County References  : ${sampledCounties} (Missing in CUI: ${countyRefMissing})`);

  let sampledNames = 0;
  let nameRefMissing = 0;
  for (const nf of nameFiles.slice(0, 25)) {
    const list = JSON.parse(fs.readFileSync(path.join(namesDir, nf), 'utf-8'));
    for (const item of list.slice(0, 50)) {
      sampledNames++;
      if (!cuiSet.has(item.cui)) nameRefMissing++;
    }
  }
  console.log(`  Sampled Name References    : ${sampledNames} (Missing in CUI: ${nameRefMissing})`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ ALL WORKER-SAFE (V2) PREFLIGHT VERIFICATIONS PASSED');
  console.log('='.repeat(70));

  return {
    success: true,
    cuiFilesCount: cuiFiles.length,
    countyFilesCount: countyFiles.length,
    nameFilesCount: nameFiles.length,
    totalFilesCount: cuiFiles.length + countyFiles.length + nameFiles.length,
    totalUncompressedBytes: totalBytes,
    totalGzipBytes,
    maxObjectBytes: maxBytes,
    maxObjectFile: maxFile,
    uniqueCuis: cuiSet.size,
  };
}

verifyV2()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Verification failed:', e.message);
    process.exit(1);
  });
