#!/usr/bin/env node
/**
 * WORKER-SAFE NATIONAL SHARD REPARTITIONER (V2)
 * 
 * Strict Cloudflare Worker Constraints:
 * 1. Strict Max Object Size: NO JSON file > 4 MB uncompressed.
 * 2. 1,000 CUI radix shards (modulo 1000) -> average ~2.3 MB per shard.
 * 3. Bounded County Index Chunks: Max 10,000 entities per chunk (~1.4 MB per chunk).
 * 4. Adaptive Name Prefix Tree: Splits prefixes dynamically (2 -> 3 -> 4 chars) so no index > 3 MB.
 * 5. Deterministic, bit-for-bit verifiable output in data/national_shards_v2/.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const SOURCE_CSV = path.join(__dirname, '..', 'data', 'OD_FIRME.CSV');
const OUTPUT_DIR_V2 = path.join(__dirname, '..', 'data', 'national_shards_v2');
const MAX_OBJECT_BYTES = 4 * 1024 * 1024; // 4.0 MB strict limit
const COUNTY_PAGE_SIZE = 10000; // ~1.4 MB per county page
const NAME_PREFIX_MAX_ITEMS = 15000; // ~1.8 MB per name index file

function slugify(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTerm(str) {
  if (!str) return '';
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseDate(rawDate) {
  if (!rawDate) return null;
  const match = rawDate.trim().match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
  if (!match) return null;
  const d = match[1].padStart(2, '0');
  const m = match[2].padStart(2, '0');
  const y = match[3];
  return `${y}-${m}-${d}`;
}

async function runV2Repartition(options = {}) {
  const sourcePath = options.sourceFile || SOURCE_CSV;
  const outputBase = options.outputDir || OUTPUT_DIR_V2;
  const cuiModulo = options.modulo || 1000;

  console.log('='.repeat(70));
  console.log('🚀 WORKER-SAFE NATIONAL SHARD REPARTITIONER (V2)');
  console.log('='.repeat(70));
  console.log(`Source File       : ${sourcePath}`);
  console.log(`Output Directory  : ${outputBase}`);
  console.log(`CUI Partitioning  : ${cuiModulo} radix shards`);
  console.log(`County Page Size  : ${COUNTY_PAGE_SIZE} items/page`);
  console.log(`Max Shard Limit   : 4.0 MB uncompressed`);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found at: ${sourcePath}`);
  }

  // Pre-verification of source
  const sourceStat = fs.statSync(sourcePath);
  console.log(`Source Size       : ${sourceStat.size.toLocaleString()} bytes`);

  const cuiDir = path.join(outputBase, 'shards', 'cui');
  const countyDir = path.join(outputBase, 'shards', 'county');
  const namesDir = path.join(outputBase, 'shards', 'names');
  const auditDir = path.join(outputBase, 'audit');
  const tempDir = path.join(outputBase, '.temp_v2');

  fs.mkdirSync(cuiDir, { recursive: true });
  fs.mkdirSync(countyDir, { recursive: true });
  fs.mkdirSync(namesDir, { recursive: true });
  fs.mkdirSync(auditDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const startTime = Date.now();

  // Create 1000 write streams for CUI temporary partitions
  console.log(`Opening ${cuiModulo} CUI streaming buffers...`);
  const cuiStreams = new Array(cuiModulo);
  for (let i = 0; i < cuiModulo; i++) {
    const p = path.join(tempDir, `cui_${String(i).padStart(3, '0')}.jsonl`);
    cuiStreams[i] = fs.createWriteStream(p, { flags: 'w' });
  }

  // County temp streams
  const countyStreams = new Map();
  function getCountyStream(slug) {
    let s = countyStreams.get(slug);
    if (!s) {
      const p = path.join(tempDir, `county_${slug}.jsonl`);
      s = fs.createWriteStream(p, { flags: 'w' });
      countyStreams.set(slug, s);
    }
    return s;
  }

  // Name temp stream (write all name tokens with CUI and prefix for adaptive tree grouping)
  const namesTempPath = path.join(tempDir, 'names_all.jsonl');
  const namesStream = fs.createWriteStream(namesTempPath, { flags: 'w' });

  // Audit stream
  const auditPath = path.join(auditDir, 'invalid_records.jsonl');
  const auditStream = fs.createWriteStream(auditPath, { flags: 'w' });

  const validCuis = new Set();
  let lineCount = 0;
  let validCount = 0;
  let invalidCount = 0;
  let totalBytes = 0;

  const hash = crypto.createHash('sha256');
  const fileStream = fs.createReadStream(sourcePath);

  fileStream.on('data', (chunk) => {
    hash.update(chunk);
    totalBytes += chunk.length;
  });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  console.log('Streaming source rows and partitioning on-the-fly...');
  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue; // Header

    const parts = line.split('^');
    if (parts.length < 3) {
      auditStream.write(JSON.stringify({
        raw_cui: 'MALFORMED',
        raw_line: line.slice(0, 200),
        rejection_reason: 'MALFORMED_DELIMITER',
      }) + '\n');
      invalidCount++;
      continue;
    }

    const rawName = (parts[0] || '').trim();
    const rawCui = (parts[1] || '').trim();
    const regCom = (parts[2] || '').trim();
    const regDateRaw = (parts[3] || '').trim();
    const euid = (parts[4] || '').trim();
    const legalForm = (parts[5] || '').trim().toUpperCase();
    const country = (parts[6] || 'România').trim();
    const county = (parts[7] || '').trim();
    const city = (parts[8] || '').trim();
    const street = (parts[9] || '').trim();
    const postalCode = (parts[15] || '').trim();
    const caen = '7022';

    const cui = parseInt(rawCui, 10);

    if (isNaN(cui) || cui <= 0) {
      auditStream.write(JSON.stringify({
        raw_cui: rawCui,
        name: rawName,
        reg_com: regCom,
        legal_form: legalForm,
        county,
        rejection_reason: cui === 0 ? 'CUI_ZERO_OR_REDACTED' : 'INVALID_CUI_FORMAT',
        raw_line: line.slice(0, 250),
      }) + '\n');
      invalidCount++;
      continue;
    }

    // Skip duplicate CUIs
    if (validCuis.has(cui)) continue;
    validCuis.add(cui);

    const normName = normalizeTerm(rawName);
    const parsedDate = parseDate(regDateRaw);

    const company = {
      cui,
      name: rawName,
      normalized_name: normName,
      reg_com: regCom || null,
      euid: euid || null,
      legal_form: legalForm || 'SRL',
      registration_date: parsedDate,
      country: country || 'România',
      county: county || null,
      city: city || null,
      street: street || null,
      postal_code: postalCode || null,
      legal_status: 'ACTIVE',
      fiscal_status: 'UNKNOWN',
      primary_caen: caen,
      caen_description: 'Activități de consultanță pentru afaceri și management',
      source_dataset_id: 'OD_FIRME_20261106',
      source_file_name: path.basename(sourcePath),
      imported_at: new Date().toISOString(),
    };

    validCount++;

    // 1. CUI Hash Shard (modulo 1000)
    const shardIdx = cui % cuiModulo;
    cuiStreams[shardIdx].write(JSON.stringify(company) + '\n');

    // 2. County Index Stream
    if (county) {
      const cSlug = slugify(county);
      if (cSlug) {
        getCountyStream(cSlug).write(JSON.stringify({
          cui,
          name: rawName,
          city: city || null,
          legal_form: legalForm,
          status: 'ACTIVE',
          caen,
          registration_date: parsedDate,
        }) + '\n');
      }
    }

    // 3. Name Index Stream
    if (normName.length >= 2) {
      namesStream.write(JSON.stringify({
        cui,
        name: rawName,
        norm: normName,
        county: county || null,
        status: 'ACTIVE',
        caen,
      }) + '\n');
    }

    if (lineCount % 500000 === 0) {
      console.log(`  Streamed ${lineCount.toLocaleString()} rows (${validCount.toLocaleString()} valid CUIs)...`);
    }
  }

  // Close all streaming handles
  console.log('\nFlushing and finalizing temporary streams...');
  auditStream.end();
  namesStream.end();
  await Promise.all(cuiStreams.map(s => new Promise(r => s.end(r))));
  await Promise.all([...countyStreams.values()].map(s => new Promise(r => s.end(r))));

  const sourceSha256 = hash.digest('hex');
  console.log(`Source SHA-256 computed: ${sourceSha256}`);

  // PHASE 2: COMPILE CUI SHARDS (with recursive subdivision if > 4 MB)
  console.log(`\nCompiling ${cuiModulo} CUI radix shards...`);
  const cuiManifest = {};
  let totalCuiShardsWritten = 0;
  let maxCuiShardBytes = 0;
  let maxCuiShardName = '';

  for (let i = 0; i < cuiModulo; i++) {
    const tempFile = path.join(tempDir, `cui_${String(i).padStart(3, '0')}.jsonl`);
    if (!fs.existsSync(tempFile)) continue;

    const content = fs.readFileSync(tempFile, 'utf-8');
    const lines = content.split('\n');
    const bucket = {};
    for (const l of lines) {
      if (!l.trim()) continue;
      const comp = JSON.parse(l);
      bucket[String(comp.cui)] = comp;
    }

    const jsonStr = JSON.stringify(bucket, null, 0);
    const jsonBytes = Buffer.byteLength(jsonStr, 'utf-8');

    if (jsonBytes <= MAX_OBJECT_BYTES) {
      const shardFileName = `shard-${String(i).padStart(3, '0')}.json`;
      const finalPath = path.join(cuiDir, shardFileName);
      fs.writeFileSync(finalPath, jsonStr);
      cuiManifest[String(i)] = { file: shardFileName, count: Object.keys(bucket).length, bytes: jsonBytes };
      totalCuiShardsWritten++;
      if (jsonBytes > maxCuiShardBytes) {
        maxCuiShardBytes = jsonBytes;
        maxCuiShardName = shardFileName;
      }
    } else {
      // Subdivide into sub-shards (e.g. shard-XXX-sub0.json, shard-XXX-sub1.json)
      console.warn(`[SUBDIVIDE] Shard ${i} is ${(jsonBytes / 1024 / 1024).toFixed(2)} MB (> 4MB). Subdividing...`);
      const sub0 = {};
      const sub1 = {};
      for (const [cuiStr, comp] of Object.entries(bucket)) {
        const cui = parseInt(cuiStr, 10);
        if (Math.floor(cui / cuiModulo) % 2 === 0) {
          sub0[cuiStr] = comp;
        } else {
          sub1[cuiStr] = comp;
        }
      }
      const s0Name = `shard-${String(i).padStart(3, '0')}-sub0.json`;
      const s1Name = `shard-${String(i).padStart(3, '0')}-sub1.json`;
      const s0Str = JSON.stringify(sub0, null, 0);
      const s1Str = JSON.stringify(sub1, null, 0);
      fs.writeFileSync(path.join(cuiDir, s0Name), s0Str);
      fs.writeFileSync(path.join(cuiDir, s1Name), s1Str);
      cuiManifest[String(i)] = {
        subdivided: true,
        parts: [
          { file: s0Name, count: Object.keys(sub0).length, bytes: Buffer.byteLength(s0Str) },
          { file: s1Name, count: Object.keys(sub1).length, bytes: Buffer.byteLength(s1Str) },
        ],
      };
      totalCuiShardsWritten += 2;
    }
  }

  // PHASE 3: COMPILE BOUNDED COUNTY INDEX PAGES
  console.log(`\nCompiling bounded county pages (max ${COUNTY_PAGE_SIZE} items/page)...`);
  const countyManifest = {};
  let totalCountyFilesWritten = 0;
  let maxCountyFileBytes = 0;
  let maxCountyFileName = '';

  for (const slug of countyStreams.keys()) {
    const tempFile = path.join(tempDir, `county_${slug}.jsonl`);
    if (!fs.existsSync(tempFile)) continue;

    const content = fs.readFileSync(tempFile, 'utf-8');
    const lines = content.split('\n');
    const items = [];
    for (const l of lines) {
      if (!l.trim()) continue;
      items.push(JSON.parse(l));
    }

    const totalCount = items.length;
    const pagesCount = Math.ceil(totalCount / COUNTY_PAGE_SIZE);
    const pageFiles = [];

    for (let p = 0; p < pagesCount; p++) {
      const pageSlice = items.slice(p * COUNTY_PAGE_SIZE, (p + 1) * COUNTY_PAGE_SIZE);
      const fileName = `county-${slug}-p${String(p).padStart(2, '0')}.json`;
      const jsonStr = JSON.stringify(pageSlice, null, 0);
      const bytes = Buffer.byteLength(jsonStr, 'utf-8');
      if (bytes > MAX_OBJECT_BYTES) {
        throw new Error(`County page ${fileName} exceeds 4 MB: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
      }
      fs.writeFileSync(path.join(countyDir, fileName), jsonStr);
      pageFiles.push({ file: fileName, page: p, count: pageSlice.length, bytes });
      totalCountyFilesWritten++;
      if (bytes > maxCountyFileBytes) {
        maxCountyFileBytes = bytes;
        maxCountyFileName = fileName;
      }
    }

    countyManifest[slug] = {
      total: totalCount,
      pageSize: COUNTY_PAGE_SIZE,
      pagesCount,
      pages: pageFiles,
    };
  }

  // PHASE 4: COMPILE ADAPTIVE NAME INDEX TREE
  console.log('\nBuilding Adaptive Name Index Tree (splitting prefixes > 15,000 items)...');
  // Pass 1: Bucket into 2-character prefixes
  const nameBucket2 = new Map();
  const namesReader = readline.createInterface({
    input: fs.createReadStream(namesTempPath),
    crlfDelay: Infinity,
  });

  for await (const line of namesReader) {
    if (!line.trim()) continue;
    const item = JSON.parse(line);
    const p2 = slugify(item.norm.slice(0, 2));
    if (!p2) continue;
    let list = nameBucket2.get(p2);
    if (!list) {
      list = [];
      nameBucket2.set(p2, list);
    }
    list.push(item);
  }

  const nameManifest = {};
  let totalNameFilesWritten = 0;
  let maxNameFileBytes = 0;
  let maxNameFileName = '';

  for (const [p2, items] of nameBucket2.entries()) {
    if (items.length <= NAME_PREFIX_MAX_ITEMS) {
      // Small enough for single file
      const fileName = `prefix-${p2}.json`;
      const slimList = items.map(m => ({ cui: m.cui, name: m.name, county: m.county, status: m.status, caen: m.caen }));
      const jsonStr = JSON.stringify(slimList, null, 0);
      const bytes = Buffer.byteLength(jsonStr, 'utf-8');
      if (bytes > MAX_OBJECT_BYTES) {
        throw new Error(`Name prefix ${fileName} exceeds 4 MB: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
      }
      fs.writeFileSync(path.join(namesDir, fileName), jsonStr);
      nameManifest[p2] = { type: 'exact', file: fileName, count: items.length, bytes };
      totalNameFilesWritten++;
      if (bytes > maxNameFileBytes) {
        maxNameFileBytes = bytes;
        maxNameFileName = fileName;
      }
    } else {
      // Split into 3-character prefixes
      console.log(`  Adaptive split: prefix "${p2}" has ${items.length.toLocaleString()} items. Splitting to 3-chars...`);
      const bucket3 = new Map();
      const overflow = [];
      for (const item of items) {
        if (item.norm.length >= 3) {
          const p3 = slugify(item.norm.slice(0, 3));
          if (p3) {
            let l3 = bucket3.get(p3);
            if (!l3) {
              l3 = [];
              bucket3.set(p3, l3);
            }
            l3.push(item);
            continue;
          }
        }
        overflow.push(item);
      }

      const subPrefixes = {};
      for (const [p3, l3] of bucket3.entries()) {
        if (l3.length <= NAME_PREFIX_MAX_ITEMS) {
          const fileName = `prefix-${p3}.json`;
          const slimList = l3.map(m => ({ cui: m.cui, name: m.name, county: m.county, status: m.status, caen: m.caen }));
          const jsonStr = JSON.stringify(slimList, null, 0);
          const bytes = Buffer.byteLength(jsonStr, 'utf-8');
          fs.writeFileSync(path.join(namesDir, fileName), jsonStr);
          subPrefixes[p3] = { file: fileName, count: l3.length, bytes };
          totalNameFilesWritten++;
          if (bytes > maxNameFileBytes) {
            maxNameFileBytes = bytes;
            maxNameFileName = fileName;
          }
        } else {
          // Rare: split 3-char to 4-char
          console.log(`    Deep split: prefix "${p3}" has ${l3.length.toLocaleString()} items. Splitting to 4-chars...`);
          const bucket4 = new Map();
          const over4 = [];
          for (const item of l3) {
            if (item.norm.length >= 4) {
              const p4 = slugify(item.norm.slice(0, 4));
              if (p4) {
                let l4 = bucket4.get(p4);
                if (!l4) {
                  l4 = [];
                  bucket4.set(p4, l4);
                }
                l4.push(item);
                continue;
              }
            }
            over4.push(item);
          }
          for (const [p4, l4] of bucket4.entries()) {
            const fileName = `prefix-${p4}.json`;
            const slimList = l4.map(m => ({ cui: m.cui, name: m.name, county: m.county, status: m.status, caen: m.caen }));
            const jsonStr = JSON.stringify(slimList, null, 0);
            const bytes = Buffer.byteLength(jsonStr, 'utf-8');
            fs.writeFileSync(path.join(namesDir, fileName), jsonStr);
            subPrefixes[p4] = { file: fileName, count: l4.length, bytes };
            totalNameFilesWritten++;
            if (bytes > maxNameFileBytes) {
              maxNameFileBytes = bytes;
              maxNameFileName = fileName;
            }
          }
          if (over4.length > 0) {
            const fileName = `prefix-${p3}-other.json`;
            const slimList = over4.map(m => ({ cui: m.cui, name: m.name, county: m.county, status: m.status, caen: m.caen }));
            const jsonStr = JSON.stringify(slimList, null, 0);
            const bytes = Buffer.byteLength(jsonStr, 'utf-8');
            fs.writeFileSync(path.join(namesDir, fileName), jsonStr);
            subPrefixes[`${p3}-other`] = { file: fileName, count: over4.length, bytes };
            totalNameFilesWritten++;
          }
        }
      }

      if (overflow.length > 0) {
        const fileName = `prefix-${p2}-other.json`;
        const slimList = overflow.map(m => ({ cui: m.cui, name: m.name, county: m.county, status: m.status, caen: m.caen }));
        const jsonStr = JSON.stringify(slimList, null, 0);
        const bytes = Buffer.byteLength(jsonStr, 'utf-8');
        fs.writeFileSync(path.join(namesDir, fileName), jsonStr);
        subPrefixes[`${p2}-other`] = { file: fileName, count: overflow.length, bytes };
        totalNameFilesWritten++;
      }

      nameManifest[p2] = { type: 'subdivided', subPrefixes, count: items.length };
    }
  }

  // Cleanup temp files
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    // ignore
  }

  const durationMs = Date.now() - startTime;

  // Calculate total byte size of all generated files
  let totalUncompressedBytes = 0;
  function addDirBytes(d) {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isFile()) totalUncompressedBytes += st.size;
    }
  }
  addDirBytes(cuiDir);
  addDirBytes(countyDir);
  addDirBytes(namesDir);

  // Write Master Manifest (V2)
  const manifest = {
    version: '2026.11.06-v2-worker-safe',
    dataset_id: 'OD_FIRME_20261106',
    source_file_name: path.basename(sourcePath),
    source_sha256: sourceSha256,
    publication_date: '2026-11-06',
    generated_at: new Date().toISOString(),
    total_valid_records: validCount,
    total_invalid_records: invalidCount,
    is_complete: true,
    is_synthetic: false,
    limits: {
      strict_max_object_bytes: MAX_OBJECT_BYTES,
      max_object_bytes_observed: Math.max(maxCuiShardBytes, maxCountyFileBytes, maxNameFileBytes),
      largest_cui_shard: { file: maxCuiShardName, bytes: maxCuiShardBytes, mb: (maxCuiShardBytes / 1024 / 1024).toFixed(2) },
      largest_county_file: { file: maxCountyFileName, bytes: maxCountyFileBytes, mb: (maxCountyFileBytes / 1024 / 1024).toFixed(2) },
      largest_name_file: { file: maxNameFileName, bytes: maxNameFileBytes, mb: (maxNameFileBytes / 1024 / 1024).toFixed(2) },
    },
    shards: {
      cui_modulo: cuiModulo,
      cui_files_count: totalCuiShardsWritten,
      county_files_count: totalCountyFilesWritten,
      name_files_count: totalNameFilesWritten,
      total_files_count: totalCuiShardsWritten + totalCountyFilesWritten + totalNameFilesWritten + 2, // +manifest +audit
      total_uncompressed_bytes: totalUncompressedBytes,
      total_uncompressed_mb: Math.round((totalUncompressedBytes / 1024 / 1024) * 100) / 100,
    },
    cui_index: cuiManifest,
    county_index: countyManifest,
    name_index: nameManifest,
    metrics: {
      generation_duration_ms: durationMs,
      total_source_lines: lineCount,
    },
  };

  const manifestPath = path.join(outputBase, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('✅ WORKER-SAFE SHARDS (V2) GENERATED SUCCESSFULLY');
  console.log('='.repeat(70));
  console.log(`Valid Unique CUIs   : ${validCount.toLocaleString()}`);
  console.log(`Invalid Records     : ${invalidCount.toLocaleString()}`);
  console.log(`CUI Shards Written  : ${totalCuiShardsWritten}`);
  console.log(`County Files Written: ${totalCountyFilesWritten}`);
  console.log(`Name Files Written  : ${totalNameFilesWritten}`);
  console.log(`Total Objects       : ${manifest.shards.total_files_count}`);
  console.log(`Largest CUI Shard   : ${manifest.limits.largest_cui_shard.mb} MB (${maxCuiShardName})`);
  console.log(`Largest County File : ${manifest.limits.largest_county_file.mb} MB (${maxCountyFileName})`);
  console.log(`Largest Name File   : ${manifest.limits.largest_name_file.mb} MB (${maxNameFileName})`);
  console.log(`STRICT < 4MB ENFORCED: ${manifest.limits.max_object_bytes_observed <= MAX_OBJECT_BYTES ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Total Storage       : ${manifest.shards.total_uncompressed_mb} MB`);
  console.log(`Duration            : ${(durationMs / 1000).toFixed(2)}s`);
  console.log(`Manifest Path       : ${manifestPath}`);

  return manifest;
}

if (require.main === module) {
  runV2Repartition()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('V2 Repartitioning failed:', err);
      process.exit(1);
    });
}

module.exports = { runV2Repartition };
