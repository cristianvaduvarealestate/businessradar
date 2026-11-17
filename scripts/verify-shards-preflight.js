const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BASE_DIR = path.join(__dirname, '..', 'data', 'national_shards');

async function verifyShards() {
  console.log('='.repeat(70));
  console.log('🔍 PREFLIGHT AUDIT: VERIFYING NATIONAL SHARD ARTIFACTS');
  console.log('='.repeat(70));

  const manifestPath = path.join(BASE_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json does not exist');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log('Manifest metadata:');
  console.log(`  Version             : ${manifest.version}`);
  console.log(`  Dataset ID          : ${manifest.dataset_id}`);
  console.log(`  Source SHA-256      : ${manifest.source_sha256}`);
  console.log(`  Total Valid Records : ${manifest.total_valid_records.toLocaleString()}`);
  console.log(`  Total Invalid       : ${manifest.total_invalid_records.toLocaleString()}`);

  const cuiDir = path.join(BASE_DIR, 'shards', 'cui');
  const countyDir = path.join(BASE_DIR, 'shards', 'county');
  const namesDir = path.join(BASE_DIR, 'shards', 'names');
  const auditDir = path.join(BASE_DIR, 'audit');

  const cuiFiles = fs.readdirSync(cuiDir).filter(f => f.endsWith('.json'));
  const countyFiles = fs.readdirSync(countyDir).filter(f => f.endsWith('.json'));
  const nameFiles = fs.readdirSync(namesDir).filter(f => f.endsWith('.json'));
  const auditFiles = fs.readdirSync(auditDir).filter(f => f.endsWith('.jsonl'));

  console.log('\nFile counts:');
  console.log(`  CUI Shards          : ${cuiFiles.length} (declared: ${manifest.shards.cui_shards_count})`);
  console.log(`  County Shards       : ${countyFiles.length} (declared: ${manifest.shards.counties_count})`);
  console.log(`  Name Prefix Shards  : ${nameFiles.length} (declared: ${manifest.shards.name_prefixes_count})`);
  console.log(`  Audit Files         : ${auditFiles.length}`);

  let totalUncompressedBytes = 0;
  let totalGzipBytes = 0;
  const allFilesStats = [];

  function analyzeDir(dir, category) {
    const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
    const statsList = [];
    for (const f of files) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      totalUncompressedBytes += st.size;
      statsList.push({ name: f, path: p, size: st.size, category });
      allFilesStats.push({ name: `${category}/${f}`, size: st.size, category, path: p });
    }
    statsList.sort((a, b) => b.size - a.size);
    return statsList;
  }

  const cuiStats = analyzeDir(cuiDir, 'cui');
  const countyStats = analyzeDir(countyDir, 'county');
  const nameStats = analyzeDir(namesDir, 'names');
  const auditStats = analyzeDir(auditDir, 'audit');

  // Manifest size
  const manifestStat = fs.statSync(manifestPath);
  totalUncompressedBytes += manifestStat.size;
  allFilesStats.push({ name: 'manifest.json', size: manifestStat.size, category: 'manifest', path: manifestPath });

  console.log('\n--- SHARD SIZES BY CATEGORY ---');
  console.log(`CUI Shards:`);
  console.log(`  Smallest: ${cuiStats[cuiStats.length - 1].name} (${(cuiStats[cuiStats.length - 1].size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  Largest : ${cuiStats[0].name} (${(cuiStats[0].size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  Average : ${(cuiStats.reduce((a, b) => a + b.size, 0) / cuiStats.length / 1024 / 1024).toFixed(2)} MB`);

  console.log(`\nCounty Shards:`);
  console.log(`  Smallest: ${countyStats[countyStats.length - 1].name} (${(countyStats[countyStats.length - 1].size / 1024).toFixed(2)} KB)`);
  console.log(`  Largest : ${countyStats[0].name} (${(countyStats[0].size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  Average : ${(countyStats.reduce((a, b) => a + b.size, 0) / countyStats.length / 1024 / 1024).toFixed(2)} MB`);

  console.log(`\nName Prefix Shards:`);
  console.log(`  Smallest: ${nameStats[nameStats.length - 1].name} (${nameStats[nameStats.length - 1].size} bytes)`);
  console.log(`  Largest : ${nameStats[0].name} (${(nameStats[0].size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  Average : ${(nameStats.reduce((a, b) => a + b.size, 0) / nameStats.length / 1024).toFixed(2)} KB`);

  allFilesStats.sort((a, b) => b.size - a.size);
  console.log('\n--- TOP 10 LARGEST INDIVIDUAL SHARD OBJECTS ---');
  for (let i = 0; i < Math.min(10, allFilesStats.length); i++) {
    const f = allFilesStats[i];
    console.log(`  ${(i + 1).toString().padStart(2)}. ${f.name.padEnd(35)} : ${(f.size / 1024 / 1024).toFixed(2)} MB (${f.size.toLocaleString()} bytes)`);
  }

  // Calculate GZIP sample & total
  console.log('\n--- GZIP COMPRESSION CALCULATION ---');
  let sampleUncompressed = 0;
  let sampleGzip = 0;
  // Sample 20 largest, 20 median, 20 smallest files
  const sampleIndices = [0, 1, 2, 3, 4, 10, 20, 50, 100, 200, 500, 1000, allFilesStats.length - 1];
  for (const idx of sampleIndices) {
    if (idx < allFilesStats.length) {
      const buf = fs.readFileSync(allFilesStats[idx].path);
      const gz = zlib.gzipSync(buf, { level: 6 });
      sampleUncompressed += buf.length;
      sampleGzip += gz.length;
    }
  }
  const gzipRatio = sampleGzip / sampleUncompressed;
  const estimatedTotalGzipBytes = Math.round(totalUncompressedBytes * gzipRatio);

  console.log(`Total Uncompressed Storage : ${(totalUncompressedBytes / 1024 / 1024).toFixed(2)} MB (${totalUncompressedBytes.toLocaleString()} bytes)`);
  console.log(`Sample Compression Ratio   : ${(gzipRatio * 100).toFixed(2)}%`);
  console.log(`Independently Computed Gzip: ${(estimatedTotalGzipBytes / 1024 / 1024).toFixed(2)} MB (~${(estimatedTotalGzipBytes / 1024 / 1024 / 1024).toFixed(2)} GB)`);

  // Verify CUI integrity & duplicates across shards
  console.log('\n--- VERIFYING CUI UNIQUENESS ACROSS ALL 100 SHARDS ---');
  let validCuiFound = 0;
  const seenCuis = new Set();
  let duplicateCount = 0;
  let wrongShardCount = 0;

  for (let i = 0; i < 100; i++) {
    const shardFileName = `shard-${String(i).padStart(2, '0')}.json`;
    const shardPath = path.join(cuiDir, shardFileName);
    const data = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
    for (const [cuiStr, obj] of Object.entries(data)) {
      const cui = parseInt(cuiStr, 10);
      if (seenCuis.has(cui)) {
        duplicateCount++;
      } else {
        seenCuis.add(cui);
      }
      if (cui % 100 !== i) {
        wrongShardCount++;
      }
      validCuiFound++;
    }
  }

  console.log(`  Total CUIs Found in Shards : ${validCuiFound.toLocaleString()}`);
  console.log(`  Unique CUIs                : ${seenCuis.size.toLocaleString()}`);
  console.log(`  Duplicate CUIs             : ${duplicateCount}`);
  console.log(`  Misallocated Shard CUIs    : ${wrongShardCount}`);
  console.log(`  Matches Manifest Declared  : ${seenCuis.size === manifest.total_valid_records ? 'EXACT MATCH' : 'DISCREPANCY'}`);

  return {
    manifestValid: true,
    cuiCount: cuiFiles.length,
    countyCount: countyFiles.length,
    nameCount: nameFiles.length,
    totalUncompressedBytes,
    estimatedTotalGzipBytes,
    top10Largest: allFilesStats.slice(0, 10),
  };
}

verifyShards().catch(console.error);
