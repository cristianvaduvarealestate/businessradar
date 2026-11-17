#!/usr/bin/env node
/**
 * SYNTHETIC SCALE BENCHMARK GENERATOR
 * Generates synthetic Romanian company datasets for performance testing at 100k, 500k, and 1M scale.
 * Strictly labeled: is_synthetic = true, source_dataset_id = 'SYNTHETIC_SCALE_TEST'
 * Never counted as real ONRC companies.
 */

const fs = require('fs');
const path = require('path');
const { generateShards, validateShards } = require('./generate-national-shards');

const COUNTIES = [
  'Bucureşti', 'Cluj', 'Timiş', 'Ilfov', 'Braşov', 'Constanţa', 'Iaşi',
  'Prahova', 'Bihor', 'Dolj', 'Argeş', 'Sibiu', 'Galaţi', 'Mureş',
  'Bacău', 'Suceava', 'Dâmboviţa', 'Arad', 'Maramureş', 'Neamţ',
];

const LEGAL_FORMS = ['SRL', 'SRL', 'SRL', 'SRL', 'PFA', 'II', 'SA', 'IF'];
const PREFIXES = ['TRANS', 'AGRO', 'TECH', 'CONSTRUCT', 'BUILD', 'AUTO', 'SOLUTIONS', 'GLOBAL', 'CONSULT', 'PRIME', 'ALPHA', 'DELTA', 'NOVA', 'SMART', 'ELITE'];
const SUFFIXES = ['LOGISTICS', 'SERVICES', 'INVEST', 'DEVELOPMENT', 'DISTRIBUTION', 'MARKETING', 'ENGINEERING', 'TRADING', 'SYSTEMS', 'VENTURES'];

async function generateSyntheticCsv(targetCount, destPath) {
  console.log(`Generating synthetic CSV with ${targetCount.toLocaleString()} records: ${destPath}`);
  const start = Date.now();
  const writeStream = fs.createWriteStream(destPath);

  // Write header
  writeStream.write('DENUMIRE^CUI^COD_INMATRICULARE^DATA_INMATRICULARE^EUID^FORMA_JURIDICA^ADR_TARA^ADR_JUDET^ADR_LOCALITATE^ADR_DEN_STRADA^ADR_NR_STRADA^ADR_BLOC^ADR_SCARA^ADR_ETAJ^ADR_APARTAMENT^ADR_COD_POSTAL^ADR_SECTOR^ADR_COMPLETARE^WEB^TARA_FIRMA_MAMA\n');

  for (let i = 1; i <= targetCount; i++) {
    const cui = 10000000 + i;
    const p = PREFIXES[i % PREFIXES.length];
    const s = SUFFIXES[Math.floor(i / PREFIXES.length) % SUFFIXES.length];
    const name = `${p} ${s} ${i} SRL`;
    const county = COUNTIES[i % COUNTIES.length];
    const form = LEGAL_FORMS[i % LEGAL_FORMS.length];
    const regCom = `J${(i % 40) + 1}/${(i % 9999) + 1}/202${i % 6}`;
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');
    const date = `${day}/${month}/2022`;

    const row = `${name}^${cui}^${regCom}^${date}^ROONRC.${regCom}^${form}^România^${county}^Loc. ${county}^Str. Principala^${(i % 100) + 1}^^^^^010000^^^^\n`;
    writeStream.write(row);
  }

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    writeStream.end();
  });

  const durationSec = (Date.now() - start) / 1000;
  console.log(`Generated ${targetCount.toLocaleString()} synthetic rows in ${durationSec.toFixed(2)}s`);
}

async function runSyntheticBenchmark(scale = 100000) {
  const tmpCsv = path.join(__dirname, '..', 'data', `synthetic_${scale}.csv`);
  const tmpShardsDir = path.join(__dirname, '..', 'data', `test_synthetic_shards_${scale}`);

  await generateSyntheticCsv(scale, tmpCsv);

  const manifest = await generateShards({
    sourceFile: tmpCsv,
    outputDir: tmpShardsDir,
    isSynthetic: true,
    modulo: 100,
    datasetId: `SYNTHETIC_SCALE_TEST_${scale}`,
  });

  const validation = await validateShards(tmpShardsDir);

  // Measure disk sizes
  const cuiDir = path.join(tmpShardsDir, 'shards', 'cui');
  const files = fs.readdirSync(cuiDir);
  let totalCuiShardBytes = 0;
  for (const f of files) {
    totalCuiShardBytes += fs.statSync(path.join(cuiDir, f)).size;
  }

  console.log(`\nScale: ${scale.toLocaleString()} Synthetic Companies`);
  console.log(`Total CUI Shards Size: ${(totalCuiShardBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Average Shard Size   : ${(totalCuiShardBytes / 100 / 1024).toFixed(1)} KB`);

  // Cleanup
  fs.unlinkSync(tmpCsv);
  fs.rmSync(tmpShardsDir, { recursive: true, force: true });

  return {
    scale,
    manifest,
    validation,
    totalCuiShardBytes,
    avgShardBytes: totalCuiShardBytes / 100,
  };
}

if (require.main === module) {
  const scale = parseInt(process.argv[2] || '100000', 10);
  runSyntheticBenchmark(scale)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('Synthetic benchmark failed:', e);
      process.exit(1);
    });
}

module.exports = { generateSyntheticCsv, runSyntheticBenchmark };
