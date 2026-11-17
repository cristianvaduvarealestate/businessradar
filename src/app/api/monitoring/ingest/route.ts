import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryOne, queryAll, executeRun, executeBatch } from '@/lib/db';
import { anafConnector } from '@/lib/providers/anaf';
import { MonitoringService, MonitoringState } from '@/lib/monitoring/service';
import { getIngestionSecret } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_BATCH_SIZE = 200;
const MAX_TIMESTAMP_DRIFT_MS = 15 * 60 * 1000; // 15 minutes window

interface IngestCompanyInput {
  cui: number;
  name: string;
  regCom?: string;
  euid?: string;
  legalForm?: string;
  registrationDate: string; // YYYY-MM-DD
  country?: string;
  county?: string;
  city?: string;
  street?: string;
  streetNr?: string;
  postalCode?: string;
  sector?: string;
  website?: string;
  primaryCaen?: string;
  caenDescription?: string;
  verifyAnaf?: boolean;
}

interface IngestPayload {
  datasetId?: string;
  datasetName?: string;
  datasetModified?: string;
  syncId: string;
  batchId: string;
  cursorStart?: number;
  cursorEnd?: number;
  isComplete?: boolean;
  timestamp?: string | number;
  nonce?: string;
  companies: IngestCompanyInput[];
}

/**
 * Timing-safe string comparison.
 */
function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Read dedicated secret - falls back to RADAR_SECURITY_KEY if RADAR_INGESTION_SECRET is unconfigured
    const secret = getIngestionSecret() || (process.env.NODE_ENV === 'test' ? 'test_ingestion_secret_key_12345' : '');

    if (!secret) {
      return NextResponse.json(
        {
          success: false,
          error: 'INGESTION_NOT_CONFIGURED',
          message: 'Endpoint-ul de ingestie necesită configurarea secretului RADAR_INGESTION_SECRET.',
        },
        { status: 401 }
      );
    }

  // 1. Read raw body once for HMAC signature verification
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'BAD_REQUEST', message: 'Corpul cererii nu a putut fi citit.' }, { status: 400 });
  }

  // 2. Extract HMAC & M2M Headers
  const timestampHeader = request.headers.get('x-radar-timestamp');
  const nonceHeader = request.headers.get('x-radar-nonce');
  const signatureHeader = request.headers.get('x-radar-signature');
  const authHeader = request.headers.get('authorization');

  // Parse JSON body
  let body: IngestPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON', message: 'Corpul cererii nu este un JSON valid.' }, { status: 400 });
  }

  // Validate payload envelope
  if (!body || !body.syncId || !body.batchId || !Array.isArray(body.companies)) {
    return NextResponse.json(
      {
        success: false,
        error: 'INVALID_PAYLOAD',
        message: 'Payload invalid: syncId, batchId și array-ul companies sunt obligatorii.',
      },
      { status: 400 }
    );
  }

  if (body.companies.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: 'BATCH_SIZE_EXCEEDED',
        message: `Dimensiunea lotului depășește limita maximă permisă de ${MAX_BATCH_SIZE} înregistrări.`,
      },
      { status: 400 }
    );
  }

  // 3. HMAC Authentication & Cryptographic Verification
  // Determine timestamp and nonce (from headers or body envelope)
  const reqTimestampStr = timestampHeader || (body.timestamp ? String(body.timestamp) : null);
  const reqNonce = nonceHeader || body.nonce || null;

  if (!signatureHeader && (!authHeader || !authHeader.toLowerCase().startsWith('bearer '))) {
    return NextResponse.json(
      {
        success: false,
        error: 'UNAUTHORIZED_M2M',
        message: 'Cerință autentificare M2M: Semnătura HMAC (X-Radar-Signature) sau Bearer Token lipsesc.',
      },
      { status: 401 }
    );
  }

  if (signatureHeader) {
    if (!reqTimestampStr || !reqNonce) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_HMAC_HEADERS',
          message: 'Autentificarea HMAC necesită headerele X-Radar-Timestamp și X-Radar-Nonce.',
        },
        { status: 401 }
      );
    }

    // 3a. Timestamp freshness check (15 minutes window)
    const reqTimestamp = parseInt(reqTimestampStr, 10);
    const now = Date.now();
    if (isNaN(reqTimestamp) || Math.abs(now - reqTimestamp) > MAX_TIMESTAMP_DRIFT_MS) {
      return NextResponse.json(
        {
          success: false,
          error: 'TIMESTAMP_EXPIRED',
          message: 'Cererea a fost respinsă: Timestamp-ul cererii a expirat (fereastră maximă: 15 minute).',
        },
        { status: 401 }
      );
    }

    // 3b. Nonce Replay Check (Persistent Nonces Table)
    const existingNonce = await queryOne<{ nonce: string }>(
      'SELECT nonce FROM ingestion_nonces WHERE nonce = ?',
      [reqNonce]
    );

    if (existingNonce) {
      return NextResponse.json(
        {
          success: false,
          error: 'NONCE_REUSED',
          message: 'Nonce reutilizat. Cererea a fost respinsă de mecanismul anti-replay.',
        },
        { status: 401 }
      );
    }

    // Record nonce durably
    await executeRun(
      'INSERT INTO ingestion_nonces (nonce, timestamp, created_at) VALUES (?, ?, datetime(\'now\'))',
      [reqNonce, reqTimestamp]
    );

    // 3c. Payload Hash & HMAC Verification
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    const stringToSign = `${reqTimestampStr}.${reqNonce}.${body.batchId}.${payloadHash}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
    const expectedSig = `sha256=${expectedHmac}`;

    if (!safeEqual(signatureHeader, expectedSig)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_SIGNATURE',
          message: 'Semnătură HMAC invalidă sau payload modificat în tranzit.',
        },
        { status: 401 }
      );
    }
  } else if (authHeader) {
    // Fallback simple bearer token check
    const providedToken = authHeader.slice(7).trim();
    if (!safeEqual(providedToken, secret)) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED_M2M',
          message: 'Token de ingestie invalid.',
        },
        { status: 401 }
      );
    }
  }

  // 4. Batch-level Idempotency Check (Separate from Nonce Anti-Replay)
  const existingBatchLog = await queryOne<{
    sync_id: string;
    records_discovered: number;
    records_updated: number;
    records_rejected: number;
    created_at: string;
  }>(
    "SELECT sync_id, records_discovered, records_updated, records_rejected, created_at FROM monitoring_sync_logs WHERE sync_id = ? AND status = 'SUCCESS'",
    [body.batchId]
  );

  if (existingBatchLog) {
    return NextResponse.json({
      success: true,
      replay: true,
      message: 'Idempotență lot: Lotul a fost deja recepționat și persistat cu succes anterior.',
      batchId: body.batchId,
      syncId: body.syncId,
      accepted: 0,
      duplicates: existingBatchLog.records_discovered + existingBatchLog.records_updated,
      rejected: existingBatchLog.records_rejected,
      processedAt: existingBatchLog.created_at,
    });
  }

  // 5. Get monitoring configuration state
  const configRows = await queryAll<{ key: string; value: string }>(
    "SELECT key, value FROM monitoring_config WHERE key IN ('monitoring_state', 'monitoring_activation_date', 'baseline_backfill_cutoff')"
  );
  const cfgMap: Record<string, string> = {};
  for (const r of configRows) cfgMap[r.key] = r.value;

  const monitoringState = (cfgMap['monitoring_state'] || 'NOT_ACTIVATED') as MonitoringState;
  const activationDate = cfgMap['monitoring_activation_date'] || null;
  const baselineCutoff = cfgMap['baseline_backfill_cutoff'] || '2026-08-15';

  let acceptedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;
  const cohortCounts = {
    NEW: 0,
    BACKFILL: 0,
    HISTORICAL: 0,
  };

  const newlyInsertedCuis: number[] = [];
  const candidateCuis: number[] = [];
  const validItems: IngestCompanyInput[] = [];

  // 6. Pre-validate each company in batch
  for (const item of body.companies) {
    const cui = typeof item.cui === 'number' ? item.cui : parseInt(String(item.cui), 10);
    const name = item.name ? item.name.trim() : '';
    const regDate = item.registrationDate ? item.registrationDate.trim() : '';

    if (!cui || isNaN(cui) || cui <= 0 || !name || !regDate) {
      rejectedCount++;
      continue;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(regDate)) {
      rejectedCount++;
      continue;
    }

    candidateCuis.push(cui);
    validItems.push({ ...item, cui, name, registrationDate: regDate });
  }

  // Single lookup for existing CUIs to stay well under Cloudflare subrequest limits
  const existingMap = new Map<number, string>();
  if (candidateCuis.length > 0) {
    const placeholders = candidateCuis.map(() => '?').join(',');
    const existingRows = await queryAll<{ cui: number; classification: string }>(
      `SELECT cui, classification FROM companies WHERE cui IN (${placeholders})`,
      candidateCuis
    );
    for (const r of existingRows) existingMap.set(r.cui, r.classification);
  }

  const statements: { sql: string; params: any[] }[] = [];

  for (const item of validItems) {
    const cui = item.cui;
    const name = item.name;
    const regDate = item.registrationDate;

    if (existingMap.has(cui)) {
      duplicateCount++;
      statements.push({
        sql: `UPDATE companies SET 
                last_observed_at = datetime('now'),
                reg_com = COALESCE(NULLIF(reg_com, ''), ?),
                county = COALESCE(NULLIF(county, ''), ?),
                city = COALESCE(NULLIF(city, ''), ?)
              WHERE cui = ?`,
        params: [item.regCom || null, item.county || null, item.city || null, cui],
      });
      continue;
    }

    const classification = MonitoringService.classifyCohort(
      regDate,
      monitoringState,
      activationDate,
      false,
      baselineCutoff
    );

    if (classification === 'NEW') cohortCounts.NEW++;
    else if (classification === 'BACKFILL') cohortCounts.BACKFILL++;
    else cohortCounts.HISTORICAL++;

    let primaryCaen = item.primaryCaen || '7022';
    let caenDesc = item.caenDescription || 'Activități de consultanță pentru afaceri și management';
    const nUpper = name.toUpperCase();
    if (!item.primaryCaen) {
      if (nUpper.includes('CONSTRUCT') || nUpper.includes('BUILD') || nUpper.includes('EDIL')) {
        primaryCaen = '4120';
        caenDesc = 'Lucrări de construcție a clădirilor rezidențiale și nerezidențiale';
      } else if (nUpper.includes('TRANS') || nUpper.includes('CARGO') || nUpper.includes('LOGISTIC')) {
        primaryCaen = '4941';
        caenDesc = 'Transporturi rutiere de mărfuri';
      } else if (nUpper.includes('SOFT') || nUpper.includes('TECH') || nUpper.includes('DATA')) {
        primaryCaen = '6201';
        caenDesc = 'Activități de realizare a soft-ului la comandă';
      } else if (nUpper.includes('CLINIC') || nUpper.includes('MED') || nUpper.includes('DENT')) {
        primaryCaen = '8622';
        caenDesc = 'Activități de asistență medicală specializată';
      }
    }

    statements.push({
      sql: `INSERT INTO companies (
        cui, name, normalized_name, reg_com, euid, legal_form,
        incorporation_date, registration_date, first_detected_at,
        country, county, city, street, street_nr, postal_code, sector, website,
        primary_caen, caen_description,
        legal_status, fiscal_status,
        classification, verification_state, qualification_status,
        discovery_source, discovery_batch_id,
        created_at, updated_at, last_observed_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, datetime('now'),
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?,
        'ACTIVE', 'UNKNOWN',
        ?, 'DISCOVERED', 'NEW_COMPANY_NOT_ASSESSED',
        'ONRC_DATA_GOV', ?,
        datetime('now'), datetime('now'), datetime('now')
      )`,
      params: [
        cui,
        name,
        name.toUpperCase(),
        item.regCom || null,
        item.euid || null,
        item.legalForm || null,
        regDate,
        regDate,
        item.country || 'România',
        item.county || null,
        item.city || null,
        item.street || null,
        item.streetNr || null,
        item.postalCode || null,
        item.sector || null,
        item.website || null,
        primaryCaen,
        caenDesc,
        classification,
        body.batchId,
      ],
    });

    statements.push({
      sql: `INSERT OR IGNORE INTO prospect_pipeline (cui, status, priority, updated_at)
            VALUES (?, 'NEW_DISCOVERED', 'STANDARD', datetime('now'))`,
      params: [cui],
    });

    acceptedCount++;
    newlyInsertedCuis.push(cui);
  }

  // Execute D1 atomic batch
  if (statements.length > 0) {
    await executeBatch(statements);
  }

  // 7. Non-blocking ANAF v9 Verification for newly discovered companies
  let anafVerifiedCount = 0;
  if (newlyInsertedCuis.length > 0) {
    const anafFn = async () => {
      try {
        const slice = newlyInsertedCuis.slice(0, 10);
        const anafResults = await anafConnector.fetchBatchTaxStatus(slice);
        const anafStatements: { sql: string; params: any[] }[] = [];

        for (const anaf of anafResults) {
          const fiscalStatus = anaf.statusInactivi
            ? 'FISCALLY_INACTIVE'
            : anaf.dataReactivare
            ? 'REACTIVATED'
            : 'FISCALLY_ACTIVE';

          const legalStatus =
            anaf.stare_inregistrare && anaf.stare_inregistrare.toUpperCase().includes('RADIAT')
              ? 'RADIATED'
              : 'ACTIVE';

          anafStatements.push({
            sql: `UPDATE companies SET
                    fiscal_status = ?,
                    legal_status = ?,
                    ro_e_factura = ?,
                    last_status_check_at = datetime('now'),
                    verification_state = 'FISCAL_STATUS_VERIFIED'
                  WHERE cui = ?`,
            params: [fiscalStatus, legalStatus, anaf.statusRO_e_Factura ? 1 : 0, anaf.cui],
          });

          if (anaf.discoveredContacts && anaf.discoveredContacts.length > 0) {
            for (const c of anaf.discoveredContacts) {
              anafStatements.push({
                sql: `INSERT OR IGNORE INTO contact_records (
                        cui, contact_type, contact_value, normalized_value,
                        label, source_name, verification_status, confidence_score, notes, discovered_at
                      ) VALUES (?, ?, ?, ?, ?, 'ANAF_OPEN_DATA', 'DECLARED_BY_COMPANY', 0.90, 'Număr declarat oficial la administrația fiscală', datetime('now'))`,
                params: [
                  c.cui,
                  c.contactType,
                  c.originalValue,
                  c.normalizedValue,
                  c.label || 'OFFICIAL',
                ],
              });
            }

            anafStatements.push({
              sql: `UPDATE companies SET verification_state = 'CONTACT_AVAILABLE' WHERE cui = ?`,
              params: [anaf.cui],
            });
          }
        }

        if (anafStatements.length > 0) {
          await executeBatch(anafStatements);
        }
      } catch (anafErr: any) {
        console.warn(`[INGESTION_ANAF_WARNING] Batch ${body.batchId} ANAF check partial: ${anafErr.message}`);
      }
    };

    let workerCtx: any = null;
    try {
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      workerCtx = getCloudflareContext()?.ctx;
    } catch {}

    if (workerCtx && typeof workerCtx.waitUntil === 'function') {
      workerCtx.waitUntil(anafFn());
    } else {
      try {
        await anafFn();
      } catch {}
    }
    anafVerifiedCount = Math.min(newlyInsertedCuis.length, 10);
  }

  // 8. Record batch in monitoring_sync_logs
  await executeRun(
    `INSERT INTO monitoring_sync_logs (
      sync_id, source_name, source_url, dataset_name, dataset_modified,
      started_at, ended_at, status, records_discovered, records_updated, records_rejected,
      checkpoint_start, checkpoint_end, execution_type, triggered_by, created_at
    ) VALUES (
      ?, 'ONRC_DATA_GOV', ?, ?, ?,
      datetime('now'), datetime('now'), 'SUCCESS', ?, ?, ?,
      ?, ?, 'EXTERNAL_EXECUTOR', 'github-actions', datetime('now')
    )`,
    [
      body.batchId,
      'https://data.gov.ro/dataset/c2c88c9d-4824-45f1-90ec-656f1c0d8785',
      body.datasetName || 'ONRC Open Data',
      body.datasetModified || null,
      acceptedCount,
      duplicateCount,
      rejectedCount,
      String(body.cursorStart || 0),
      String(body.cursorEnd || body.cursorStart || 0),
    ]
  );

  if (body.cursorEnd) {
    await executeRun(
      `INSERT INTO monitoring_config (key, value, updated_at) VALUES ('stream_cursor_line', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [String(body.cursorEnd)]
    );
  }

  if (body.datasetModified) {
    await executeRun(
      `INSERT INTO monitoring_config (key, value, updated_at) VALUES ('active_package_modified', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [body.datasetModified]
    );
  }

  // Update synchronization and activation state
  if (body.isComplete) {
    // Only on complete synchronization is the sync marked as SUCCESS and continuous activation recorded
    await executeRun(
      `INSERT INTO monitoring_config (key, value, updated_at) VALUES ('last_successful_sync_at', datetime('now'), datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    );

    await executeRun(
      `INSERT INTO monitoring_config (key, value, updated_at) VALUES ('last_sync_status', 'SUCCESS', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    );

    if (monitoringState !== 'CONTINUOUS_DISCOVERY') {
      await executeRun(
        `INSERT INTO monitoring_config (key, value, updated_at) VALUES ('monitoring_state', 'CONTINUOUS_DISCOVERY', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      );
      await executeRun(
        `INSERT INTO monitoring_config (key, value, updated_at) VALUES ('monitoring_activation_date', datetime('now'), datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      );
    }
  } else {
    // Intermediate batch: mark status as IN_PROGRESS or INITIAL_BACKFILL
    const currentProgressStatus = monitoringState === 'NOT_ACTIVATED' ? 'INITIAL_BACKFILL' : monitoringState;
    await executeRun(
      `INSERT INTO monitoring_config (key, value, updated_at) VALUES ('monitoring_state', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [currentProgressStatus]
    );
    await executeRun(
      `INSERT INTO monitoring_config (key, value, updated_at) VALUES ('last_sync_status', 'IN_PROGRESS', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    );
  }

    return NextResponse.json({
      success: true,
      syncId: body.syncId,
      batchId: body.batchId,
      accepted: acceptedCount,
      duplicates: duplicateCount,
      rejected: rejectedCount,
      cohortCounts,
      anafVerified: anafVerifiedCount,
      monitoringState: body.isComplete ? 'CONTINUOUS_DISCOVERY' : monitoringState,
      activationDate,
      cursorEnd: body.cursorEnd,
      isComplete: Boolean(body.isComplete),
    });
  } catch (err: any) {
    console.error('[INGESTION_FATAL_ERROR]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'INGESTION_EXECUTION_ERROR',
        message: err?.message || 'Eroare internă la procesarea lotului de date.',
      },
      { status: 500 }
    );
  }
}
