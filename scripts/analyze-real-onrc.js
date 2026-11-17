const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Database = require('better-sqlite3');

const CSV_PATH = path.join(__dirname, '..', 'data', 'OD_FIRME.CSV');
const HISTORICAL_DB_PATH = path.join(__dirname, '..', 'data', 'radar_business.db');

async function analyze() {
  console.log('='.repeat(70));
  console.log('🇷🇴 ANALYZING REAL ONRC DATASET (4.23M ROWS)');
  console.log('='.repeat(70));

  // Load existing 2,908 historical CUIs
  const db = new Database(HISTORICAL_DB_PATH, { readonly: true });
  const historicalCuis = new Set(
    db.prepare('SELECT cui FROM companies WHERE cui IS NOT NULL').all().map(r => r.cui)
  );
  console.log(`Loaded ${historicalCuis.size} historical companies from radar_business.db`);
  db.close();

  const fileStream = fs.createReadStream(CSV_PATH, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let validCuiCount = 0;
  let zeroCuiCount = 0;
  let malformedCount = 0;
  let duplicateCuiCount = 0;

  const validCuiSet = new Set();
  const matchedHistoricalCuis = new Set();
  const legalFormStats = {};

  const startTime = Date.now();
  let lastLog = Date.now();

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue; // Header

    const parts = line.split('^');
    if (parts.length < 3) {
      malformedCount++;
      continue;
    }

    const rawCui = (parts[1] || '').trim();
    const legalForm = (parts[5] || 'OTHER').trim().toUpperCase();
    const cui = parseInt(rawCui, 10);

    if (isNaN(cui) || cui <= 0) {
      zeroCuiCount++;
      continue;
    }

    legalFormStats[legalForm] = (legalFormStats[legalForm] || 0) + 1;

    if (validCuiSet.has(cui)) {
      duplicateCuiCount++;
      continue;
    }

    validCuiSet.add(cui);
    validCuiCount++;

    if (historicalCuis.has(cui)) {
      matchedHistoricalCuis.add(cui);
    }

    if (lineCount % 500000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Processed ${lineCount.toLocaleString()} rows (${validCuiCount.toLocaleString()} valid CUIs, ${zeroCuiCount.toLocaleString()} zero/redacted) in ${elapsed}s...`);
    }
  }

  const durationSec = (Date.now() - startTime) / 1000;

  console.log('\n' + '='.repeat(70));
  console.log('📊 REAL ONRC DATASET AUDIT RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Source Rows    : ${(lineCount - 1).toLocaleString()}`);
  console.log(`Unique Valid CUIs    : ${validCuiCount.toLocaleString()}`);
  console.log(`Zero / Redacted CUIs : ${zeroCuiCount.toLocaleString()}`);
  console.log(`Duplicate CUI Rows   : ${duplicateCuiCount.toLocaleString()}`);
  console.log(`Malformed Lines      : ${malformedCount.toLocaleString()}`);
  console.log(`Processing Duration  : ${durationSec.toFixed(2)} seconds`);
  console.log(`Processing Speed     : ${Math.round((lineCount - 1) / durationSec).toLocaleString()} rows/sec`);

  console.log('\n🏛️ TOP LEGAL FORMS:');
  const sortedForms = Object.entries(legalFormStats).sort((a, b) => b[1] - a[1]);
  for (const [form, count] of sortedForms.slice(0, 10)) {
    console.log(`  - ${form.padEnd(12)}: ${count.toLocaleString()}`);
  }

  console.log('\n🔍 HISTORICAL DATABASE RECONCILIATION:');
  console.log(`  Total Historical Companies in radar_business.db: ${historicalCuis.size}`);
  console.log(`  Historical Companies Matched in Real ONRC Source: ${matchedHistoricalCuis.size} (${((matchedHistoricalCuis.size / historicalCuis.size) * 100).toFixed(2)}%)`);
  
  const missingHistorical = historicalCuis.size - matchedHistoricalCuis.size;
  console.log(`  Historical Companies Not Found in ONRC Source   : ${missingHistorical}`);

  return {
    totalSourceRows: lineCount - 1,
    uniqueValidCuis: validCuiCount,
    zeroCuiCount,
    duplicateCuiCount,
    malformedCount,
    matchedHistoricalCuis: matchedHistoricalCuis.size,
    totalHistoricalCuis: historicalCuis.size,
    durationSec,
  };
}

analyze()
  .then((res) => {
    fs.writeFileSync(
      path.join(__dirname, '..', 'data', 'real_onrc_audit_summary.json'),
      JSON.stringify(res, null, 2)
    );
    process.exit(0);
  })
  .catch((e) => {
    console.error('Audit failed:', e);
    process.exit(1);
  });
