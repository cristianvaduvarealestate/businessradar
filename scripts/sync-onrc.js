#!/usr/bin/env node
/**
 * RADAR BUSINESS ROMÂNIA — External ONRC Continuous Discovery Executor
 * 
 * Supports:
 *  1. Remote API Ingestion Mode (GitHub Actions -> Cloudflare Worker /api/monitoring/ingest)
 *  2. Direct Database Mode (Local development CLI -> SQLite)
 *  3. Streaming caret parser (^ delimiter) without buffering in memory
 *  4. Cohort classification: INITIAL BACKFILL (2026-08-15 to cutoff) & CONTINUOUS DISCOVERY (>= cutoff)
 *  5. Checkpoint resumption and dataset modification change detection
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const readline = require('readline');
const crypto = require('crypto');

// Parse CLI arguments
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}
const hasFlag = (flag) => args.includes(flag);

const MODE = getArg('--mode', process.env.RADAR_INGESTION_URL ? 'api' : 'direct');
const API_URL = getArg('--api', process.env.RADAR_INGESTION_URL || 'https://businessradar.cristianvaduva.com/api/monitoring/ingest');
const TOKEN = getArg('--token', process.env.RADAR_INGESTION_SECRET || '');
const DB_PATH = getArg('--db', path.join(__dirname, '..', 'data', 'radar_business.db'));
const LIMIT = parseInt(getArg('--limit', '0'), 10); // 0 = unlimited
const BATCH_SIZE = Math.min(200, Math.max(10, parseInt(getArg('--batch-size', '50'), 10)));
const FORCE = hasFlag('--force');
const DRY_RUN = hasFlag('--dry-run');
const LOCAL_FILE = getArg('--local-file', null);
const ACTIVATION_DATE_OVERRIDE = getArg('--activation-date', null);

const CKAN_PACKAGE_URL = 'https://data.gov.ro/api/3/action/package_show?id=c2c88c9d-4824-45f1-90ec-656f1c0d8785';
const DEFAULT_CSV_FALLBACK = 'https://data.gov.ro/dataset/c2c88c9d-4824-45f1-90ec-656f1c0d8785/resource/869eac01-8480-4ac6-a18d-d0f044b0db80/download/od_firme.csv';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'RadarBusinessRomania-Executor/2.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function postJson(url, payload, bearerToken) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(payload);

    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const payloadHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
    const stringToSign = `${timestamp}.${nonce}.${payload.batchId}.${payloadHash}`;
    const signature = bearerToken
      ? `sha256=${crypto.createHmac('sha256', bearerToken).update(stringToSign).digest('hex')}`
      : '';

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      'User-Agent': 'RadarBusinessRomania-Executor/2.0',
    };
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
      headers['X-Radar-Timestamp'] = timestamp;
      headers['X-Radar-Nonce'] = nonce;
      headers['X-Radar-Signature'] = signature;
    }

    const req = client.request(
      url,
      {
        method: 'POST',
        headers,
        timeout: 30000,
      },
      (res) => {
        let resData = '';
        res.on('data', (c) => (resData += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(resData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || parsed.error || resData}`));
            }
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}: ${resData}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ingestion POST request timed out after 30s'));
    });
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const startTime = Date.now();
  console.log('='.repeat(70));
  console.log(`[${new Date().toISOString()}] BUSINESS RADAR — ONRC DISCOVERY EXECUTOR`);
  console.log(`Execution Mode: ${MODE.toUpperCase()}`);
  console.log(`Target: ${MODE === 'api' ? API_URL : DB_PATH}`);
  console.log(`Batch Size: ${BATCH_SIZE} | Limit: ${LIMIT > 0 ? LIMIT : 'UNLIMITED'} | Force: ${FORCE}`);
  console.log('='.repeat(70));

  let db = null;
  let activationCutoff = ACTIVATION_DATE_OVERRIDE || '2026-10-01';
  let lastRecordedModified = null;
  let startCursor = 0;

  if (MODE === 'direct') {
    const Database = require('better-sqlite3');
    if (!fs.existsSync(DB_PATH)) {
      console.error(`Database file not found at: ${DB_PATH}`);
      process.exit(1);
    }
    db = new Database(DB_PATH);
    try {
      const cfgRows = db.prepare('SELECT key, value FROM monitoring_config').all();
      const cfg = {};
      for (const r of cfgRows) cfg[r.key] = r.value;
      if (!ACTIVATION_DATE_OVERRIDE && cfg.monitoring_activation_date) {
        activationCutoff = cfg.monitoring_activation_date;
      }
      lastRecordedModified = cfg.active_package_modified || null;
      startCursor = parseInt(cfg.stream_cursor_line || '0', 10);
    } catch (e) {
      console.warn('Could not read monitoring_config, using defaults.');
    }
  }

  console.log(`Monitoring Activation Cutoff: ${activationCutoff}`);

  // 1. Check CKAN Metadata
  let packageInfo = null;
  let datasetUrl = DEFAULT_CSV_FALLBACK;
  let datasetTitle = 'ONRC Open Data';
  let datasetModified = null;
  let packageId = 'c2c88c9d-4824-45f1-90ec-656f1c0d8785';

  if (!LOCAL_FILE) {
    try {
      console.log('Interrogating data.gov.ro CKAN API for latest ONRC dataset metadata...');
      const ckanRes = await fetchJson(CKAN_PACKAGE_URL);
      if (ckanRes && ckanRes.result) {
        packageInfo = ckanRes.result;
        datasetTitle = packageInfo.title || datasetTitle;
        datasetModified = packageInfo.metadata_modified || null;
        packageId = packageInfo.id || packageId;

        const csvRes = packageInfo.resources.find(
          (r) => r.name === 'OD_FIRME.CSV' || r.url.endsWith('od_firme.csv') || r.url.endsWith('OD_FIRME.CSV')
        );
        if (csvRes && csvRes.url) {
          datasetUrl = csvRes.url;
        }
      }
      console.log(`Dataset Title: ${datasetTitle}`);
      console.log(`Dataset Modified: ${datasetModified}`);
      console.log(`Dataset Resource URL: ${datasetUrl}`);
    } catch (err) {
      console.warn(`Could not fetch CKAN API metadata (${err.message}). Using default resource URL.`);
    }

    // 2. Check if dataset is unchanged and previously completed
    if (!FORCE && datasetModified && lastRecordedModified === datasetModified && startCursor > 100000) {
      console.log(`[INFO] Dataset ${packageId} has not changed since ${datasetModified} and was completed.`);
      console.log('Skipping reprocessing. Use --force to override.');
      process.exit(0);
    }
  } else {
    console.log(`Using local file: ${LOCAL_FILE}`);
    datasetTitle = `Local Slice: ${path.basename(LOCAL_FILE)}`;
  }

  // 3. Prepare InputStream
  let inputStream;
  if (LOCAL_FILE) {
    inputStream = fs.createReadStream(LOCAL_FILE, { encoding: 'utf-8' });
  } else {
    console.log(`Establishing streaming HTTP connection to: ${datasetUrl}...`);
    inputStream = await new Promise((resolve, reject) => {
      const client = datasetUrl.startsWith('https') ? https : http;
      client
        .get(
          datasetUrl,
          {
            headers: {
              'User-Agent': 'RadarBusinessRomania-Executor/2.0 (B2B Insurance Intelligence Ingestion)',
            },
          },
          (res) => {
            if (res.statusCode !== 200) {
              return reject(new Error(`Server returned HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
            resolve(res);
          }
        )
        .on('error', reject);
    });
  }

  const syncId = `exec_sync_${Date.now()}`;
  let batchIndex = 0;
  let batchBuffer = [];
  let lineCount = 0;
  let validCuiCount = 0;
  let rejectedCount = 0;
  let discoveredNewCount = 0;
  let discoveredBackfillCount = 0;
  let duplicatesSkippedCount = 0;

  console.log(`Starting streaming line-by-line caret parser (batch size: ${BATCH_SIZE})...`);

  // Existing CUIs lookup set for direct mode
  const localKnownCuis = new Set();
  if (MODE === 'direct' && db) {
    const existing = db.prepare('SELECT cui FROM companies').all();
    for (const r of existing) localKnownCuis.add(r.cui);
    console.log(`Loaded ${localKnownCuis.size} existing CUIs from local DB for in-memory deduplication.`);
  }

  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity,
  });

  const sendBatch = async (isFinal = false) => {
    if (batchBuffer.length === 0) return;
    batchIndex++;
    const batchId = `batch_${syncId}_${batchIndex}`;
    const payload = {
      datasetId: packageId,
      datasetName: datasetTitle,
      datasetModified,
      syncId,
      batchId,
      cursorStart: lineCount - batchBuffer.length,
      cursorEnd: lineCount,
      isComplete: isFinal,
      companies: batchBuffer,
    };

    if (DRY_RUN) {
      console.log(`[DRY-RUN] Assembled batch ${batchId} with ${batchBuffer.length} companies.`);
      batchBuffer = [];
      return;
    }

    if (MODE === 'api') {
      try {
        const resp = await postJson(API_URL, payload, TOKEN);
        console.log(
          `[BATCH ${batchIndex}] Posted ${batchBuffer.length} companies -> Accepted: ${resp.accepted}, Duplicates: ${resp.duplicates}, ANAF Verified: ${resp.anafVerified}`
        );
      } catch (err) {
        console.error(`[BATCH ERROR] Failed to send batch ${batchId}: ${err.message}`);
        throw err;
      }
    } else if (MODE === 'direct' && db) {
      const insertCompany = db.prepare(`
        INSERT INTO companies (
          cui, name, normalized_name, reg_com, euid, legal_form,
          incorporation_date, registration_date, first_detected_at,
          country, county, city, street, street_nr, website,
          primary_caen, caen_description,
          legal_status, fiscal_status,
          classification, verification_state, qualification_status,
          discovery_source, discovery_batch_id,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, datetime('now'),
          ?, ?, ?, ?, ?, ?,
          ?, ?,
          'ACTIVE', 'UNKNOWN',
          ?, 'DISCOVERED', 'NEW_COMPANY_NOT_ASSESSED',
          'ONRC_DATA_GOV', ?,
          datetime('now'), datetime('now')
        )
      `);

      const insertPipeline = db.prepare(`
        INSERT OR IGNORE INTO prospect_pipeline (cui, status, priority, updated_at)
        VALUES (?, 'NEW_DISCOVERED', 'STANDARD', datetime('now'))
      `);

      const tx = db.transaction((items) => {
        for (const item of items) {
          let classification = 'HISTORICAL';
          if (item.registrationDate >= activationCutoff) {
            classification = 'NEW';
          } else if (item.registrationDate >= '2026-08-15') {
            classification = 'BACKFILL';
          }

          insertCompany.run(
            item.cui,
            item.name,
            item.name.toUpperCase(),
            item.regCom || null,
            item.euid || null,
            item.legalForm || null,
            item.registrationDate,
            item.registrationDate,
            item.country || 'România',
            item.county || null,
            item.city || null,
            item.street || null,
            item.streetNr || null,
            item.website || null,
            item.primaryCaen || '7022',
            item.caenDescription || 'Consultanță afaceri',
            classification,
            batchId
          );
          insertPipeline.run(item.cui);
          localKnownCuis.add(item.cui);
        }
      });

      tx(batchBuffer);
      console.log(`[DIRECT DB BATCH ${batchIndex}] Committed ${batchBuffer.length} companies to local SQLite.`);
    }

    batchBuffer = [];
  };

  try {
    for await (const line of rl) {
      lineCount++;
      if (lineCount === 1) continue; // Skip header

      if (!line || !line.trim()) continue;

      const cols = line.split('^').map((s) => s.trim().replace(/^"|"$/g, ''));
      if (cols.length < 4) {
        rejectedCount++;
        continue;
      }

      const rawName = cols[0];
      const rawCui = cols[1];
      const rawRegCom = cols[2];
      const rawRegDate = cols[3];

      const cui = parseInt(rawCui, 10);
      if (!cui || isNaN(cui) || cui <= 0 || !rawName) {
        rejectedCount++;
        continue;
      }
      validCuiCount++;

      // Parse registration date DD/MM/YYYY -> YYYY-MM-DD
      let isoDate = null;
      if (rawRegDate.includes('/')) {
        const parts = rawRegDate.split(' ')[0].split('/');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } else if (rawRegDate.includes('-')) {
        isoDate = rawRegDate.split(' ')[0];
      }

      if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        rejectedCount++;
        continue;
      }

      // Check if candidate for FIRME NOI (either BACKFILL >= 2026-08-15 or NEW >= activationCutoff)
      const isNew = isoDate >= activationCutoff;
      const isBackfill = isoDate >= '2026-08-15' && isoDate < activationCutoff;

      if (!isNew && !isBackfill) {
        // Historical company: if already in DB, skip
        if (localKnownCuis.has(cui)) {
          duplicatesSkippedCount++;
          continue;
        }
      } else {
        // Candidate for discovery! Check if already known
        if (localKnownCuis.has(cui)) {
          duplicatesSkippedCount++;
          continue;
        }
      }

      if (isNew) discoveredNewCount++;
      if (isBackfill) discoveredBackfillCount++;

      // CAEN classification
      let primaryCaen = '7022';
      let caenDescription = 'Activități de consultanță pentru afaceri și management';
      const nUpper = rawName.toUpperCase();
      if (nUpper.includes('CONSTRUCT') || nUpper.includes('BUILD') || nUpper.includes('EDIL')) {
        primaryCaen = '4120';
        caenDescription = 'Lucrări de construcție a clădirilor rezidențiale și nerezidențiale';
      } else if (nUpper.includes('TRANS') || nUpper.includes('CARGO') || nUpper.includes('LOGISTIC')) {
        primaryCaen = '4941';
        caenDescription = 'Transporturi rutiere de mărfuri';
      } else if (nUpper.includes('SOFT') || nUpper.includes('TECH') || nUpper.includes('DATA')) {
        primaryCaen = '6201';
        caenDescription = 'Activități de realizare a soft-ului la comandă';
      } else if (nUpper.includes('CLINIC') || nUpper.includes('MED') || nUpper.includes('DENT')) {
        primaryCaen = '8622';
        caenDescription = 'Activități de asistență medicală specializată';
      }

      batchBuffer.push({
        cui,
        name: rawName,
        regCom: rawRegCom,
        euid: cols[4] || undefined,
        legalForm: cols[5] || undefined,
        registrationDate: isoDate,
        country: cols[6] || 'România',
        county: cols[7] || undefined,
        city: cols[8] || undefined,
        street: cols[9] || undefined,
        streetNr: cols[10] || undefined,
        postalCode: cols[15] || undefined,
        sector: cols[16] || undefined,
        website: cols[18] || undefined,
        primaryCaen,
        caenDescription,
      });

      if (batchBuffer.length >= BATCH_SIZE) {
        await sendBatch(false);
      }

      if (LIMIT > 0 && (discoveredNewCount + discoveredBackfillCount) >= LIMIT) {
        console.log(`Target limit of ${LIMIT} companies reached. Halting stream.`);
        rl.close();
        if (inputStream.destroy) inputStream.destroy();
        break;
      }

      if (lineCount % 100000 === 0) {
        console.log(`[PROGRESS] Processed ${lineCount} lines | Valid CUIs: ${validCuiCount} | Continuous NEW: ${discoveredNewCount} | Backfill: ${discoveredBackfillCount} | Duplicates: ${duplicatesSkippedCount}`);
      }
    }

    // Send final remaining buffer
    if (batchBuffer.length > 0) {
      await sendBatch(true);
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('='.repeat(70));
    console.log(`[SUCCESS] Ingestion completed in ${durationSec}s.`);
    console.log(`Lines Processed: ${lineCount}`);
    console.log(`Valid Numeric CUIs: ${validCuiCount}`);
    console.log(`Continuous Discovery (NEW >= ${activationCutoff}): ${discoveredNewCount}`);
    console.log(`Initial Backfill (2026-08-15 to ${activationCutoff}): ${discoveredBackfillCount}`);
    console.log(`Duplicate Historical CUIs Skipped: ${duplicatesSkippedCount}`);
    console.log(`Rejected / Malformed Lines: ${rejectedCount}`);
    console.log('='.repeat(70));
  } catch (err) {
    console.error(`[EXECUTION FAILED] ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
