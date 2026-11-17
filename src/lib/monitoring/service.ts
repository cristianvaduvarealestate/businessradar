import { queryAll, queryOne, executeRun, executeBatch } from '@/lib/db';
import { anafConnector } from '@/lib/providers/anaf';
import { ContactNormalizer } from '@/lib/enrichment/normalizer';
import { InsuranceIntelligenceService } from '@/lib/insurance/intelligence';

export type MonitoringState =
  | 'NOT_ACTIVATED'
  | 'INITIAL_BACKFILL'
  | 'CONTINUOUS_DISCOVERY'
  | 'SOURCE_UNAVAILABLE'
  | 'SYNC_FAILED';

export interface MonitoringConfig {
  monitoring_state: MonitoringState;
  monitoring_status: string;
  monitoring_activation_date: string;
  baseline_backfill_cutoff: string;
  auto_sync_enabled: string;
  cron_schedule: string;
  batch_limit: string;
  active_source: string;
  active_source_url: string;
  active_package_id: string;
  active_package_title: string;
  active_package_modified: string;
  active_package_etag?: string;
  active_package_expected_size?: string;
  stream_cursor_line: string;
  sync_lock: string;
  last_successful_sync_at: string;
  last_attempted_sync_at: string;
  last_sync_status: string;
  last_sync_error: string;
  total_discovered_count: string;
}

export interface MonitoringSyncLog {
  id?: number;
  sync_id: string;
  source_name: string;
  source_url?: string;
  dataset_name?: string;
  dataset_modified?: string;
  started_at: string;
  ended_at?: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  records_discovered: number;
  records_updated: number;
  records_rejected: number;
  checkpoint_start?: string;
  checkpoint_end?: string;
  error_message?: string;
  execution_type: 'SCHEDULED' | 'MANUAL_ADMIN' | 'CLI';
  triggered_by?: string;
  created_at?: string;
}

export interface SyncResult {
  success: boolean;
  syncId: string;
  discoveredCount: number;
  updatedCount: number;
  rejectedCount: number;
  cursorLine: number;
  message: string;
  error?: string;
  durationMs?: number;
}

const DEFAULT_ONRC_PACKAGE_URL =
  'https://businessradar.cristianvaduva.com/data/onrc_recent_registrations.csv';

export class MonitoringService {
  /**
   * Verify if monitoring schema (migration 0012) has been initialized in the database.
   * Read-only schema check that never throws.
   */
  static async checkSchemaInitialized(): Promise<{
    initialized: boolean;
    missingTables: string[];
    missingColumns: string[];
    underlyingError?: string;
  }> {
    try {
      const rows = await queryAll<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('monitoring_config', 'monitoring_sync_logs', 'ingestion_nonces')"
      );
      const foundTables = new Set(rows.map((r) => r.name));
      const requiredTables = ['monitoring_config', 'monitoring_sync_logs', 'ingestion_nonces'];
      const missingTables = requiredTables.filter((t) => !foundTables.has(t));

      // Also check if companies table has discovery columns (classification)
      let missingColumns: string[] = [];
      try {
        const colRows = await queryAll<{ name: string }>("PRAGMA table_info(companies)");
        const colSet = new Set(colRows.map((c) => c.name));
        const requiredCols = ['classification', 'first_detected_at', 'verification_state'];
        missingColumns = requiredCols.filter((c) => !colSet.has(c));
      } catch {}

      if (missingTables.length > 0 || missingColumns.length > 0) {
        return {
          initialized: false,
          missingTables,
          missingColumns,
          underlyingError: `D1_ERROR: no such table: ${missingTables[0] || 'monitoring_config'}: SQLITE_ERROR`,
        };
      }

      return { initialized: true, missingTables: [], missingColumns: [] };
    } catch (e: any) {
      return {
        initialized: false,
        missingTables: ['monitoring_config', 'monitoring_sync_logs', 'ingestion_nonces'],
        missingColumns: ['classification'],
        underlyingError: e?.message || 'D1_ERROR: no such table: monitoring_config: SQLITE_ERROR',
      };
    }
  }

  /**
   * Retrieve all configuration key-values
   */
  static async getConfig(): Promise<Record<string, string>> {
    try {
      const rows = await queryAll<{ key: string; value: string }>(
        'SELECT key, value FROM monitoring_config'
      );
      const config: Record<string, string> = {};
      for (const r of rows) {
        config[r.key] = r.value;
      }
      return config;
    } catch (e: any) {
      return {
        _schema_status: 'MIGRATION_REQUIRED',
        _schema_error: e?.message || 'D1_ERROR: no such table: monitoring_config: SQLITE_ERROR',
        monitoring_state: 'NOT_INITIALIZED',
        monitoring_status: 'MIGRATION_REQUIRED',
        monitoring_activation_date: '',
        last_sync_status: 'MIGRATION_REQUIRED',
        total_discovered_count: '0',
        stream_cursor_line: '0',
      };
    }
  }

  /**
   * Update a configuration key
   */
  static async updateConfigKey(key: string, value: string): Promise<void> {
    await executeRun(
      `INSERT INTO monitoring_config (key, value, updated_at) 
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, value]
    );
  }

  /**
   * Retrieve recent sync logs
   */
  static async getSyncLogs(limit: number = 20): Promise<MonitoringSyncLog[]> {
    try {
      return await queryAll<MonitoringSyncLog>(
        'SELECT * FROM monitoring_sync_logs ORDER BY started_at DESC LIMIT ?',
        [limit]
      );
    } catch {
      return [];
    }
  }

  /**
   * Determine cohort classification based on registration date and continuous monitoring state.
   *
   * Semantic rules:
   * 1. Existing database CUIs remain strictly HISTORICAL.
   * 2. Companies registered before baseline_cutoff (2026-08-15) remain strictly HISTORICAL.
   * 3. Before complete baseline synchronization (NOT_ACTIVATED or INITIAL_BACKFILL),
   *    no company is classified as NEW. They are classified as BACKFILL.
   * 4. Only when monitoring_state is CONTINUOUS_DISCOVERY AND the company was registered
   *    on or after the recorded activation date is it classified as NEW.
   */
  static classifyCohort(
    registrationDate: string,
    monitoringState: MonitoringState,
    activationDate: string | null | undefined,
    isExistingCui: boolean,
    baselineCutoff: string = '2026-08-15'
  ): 'HISTORICAL' | 'BACKFILL' | 'NEW' {
    if (isExistingCui) return 'HISTORICAL';
    if (!registrationDate || registrationDate < baselineCutoff) return 'HISTORICAL';

    // Continuous discovery is active only after the first complete sync
    if (
      monitoringState === 'CONTINUOUS_DISCOVERY' &&
      activationDate &&
      activationDate.trim() !== '' &&
      registrationDate >= activationDate
    ) {
      return 'NEW';
    }

    return 'BACKFILL';
  }

  /**
   * Parse caret delimited line safely
   */
  static parseCsvLine(line: string, delimiter: string = '^'): string[] {
    return line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ''));
  }

  /**
   * Derive initial CAEN from company name or legal form
   */
  static deriveCaen(name: string, legalForm?: string): { caen: string; description: string } {
    const n = (name || '').toUpperCase();
    if (n.includes('CONSTRUCT') || n.includes('BUILD') || n.includes('EDIL') || n.includes('INSTAL')) {
      return { caen: '4120', description: 'Lucrări de construcție a clădirilor rezidențiale și nerezidențiale' };
    }
    if (n.includes('TRANS') || n.includes('LOGISTIC') || n.includes('CARGO') || n.includes('TRANSPORT') || n.includes('CURER')) {
      return { caen: '4941', description: 'Transporturi rutiere de mărfuri' };
    }
    if (n.includes('SOFT') || n.includes('TECH') || n.includes('DATA') || n.includes('CYBER') || n.includes('DIGITAL') || n.includes('CLOUD')) {
      return { caen: '6201', description: 'Activități de realizare a soft-ului la comandă' };
    }
    if (n.includes('HOTEL') || n.includes('PENSIUN') || n.includes('CAZARE')) {
      return { caen: '5510', description: 'Hoteluri și alte facilități de cazare similare' };
    }
    if (n.includes('REST') || n.includes('CAFE') || n.includes('BISTRO') || n.includes('PIZZA') || n.includes('PUB') || n.includes('FOOD')) {
      return { caen: '5610', description: 'Restaurante' };
    }
    if (n.includes('CLINIC') || n.includes('MED') || n.includes('DENT') || n.includes('FARM') || n.includes('HEALTH') || n.includes('SANATAT')) {
      return { caen: '8622', description: 'Activități de asistență medicală specializată' };
    }
    if (n.includes('AUTO') || n.includes('SERVICE') || n.includes('GARAGE') || n.includes('MECANIC')) {
      return { caen: '4520', description: 'Întreținerea și repararea autovehiculelor' };
    }
    if (n.includes('IMOB') || n.includes('ESTATE') || n.includes('PROPERTY') || n.includes('RESIDENCE')) {
      return { caen: '6820', description: 'Închirierea și subînchirierea bunurilor imobiliare' };
    }
    if (n.includes('CONSULT') || n.includes('ADVISORY') || n.includes('MANAGEMENT') || n.includes('BUSINESS')) {
      return { caen: '7022', description: 'Activități de consultanță pentru afaceri și management' };
    }
    if (n.includes('SOLAR') || n.includes('ENERGY') || n.includes('WIND') || n.includes('FOTOVOLTAIC')) {
      return { caen: '3511', description: 'Producția de energie electrică' };
    }
    if (n.includes('COMERT') || n.includes('SHOP') || n.includes('STORE') || n.includes('DISTRIBUT')) {
      return { caen: '4711', description: 'Comerț cu amănuntul în magazine nespecializate' };
    }
    if (legalForm === 'PFA' || legalForm === 'II') {
      return { caen: '7022', description: 'Servicii profesionale și consultanță' };
    }
    return { caen: '7022', description: 'Activități de consultanță pentru afaceri și management' };
  }

  /**
   * Assess qualification status for newly discovered company
   */
  static assessQualification(company: {
    caen: string;
    legalStatus: string;
    fiscalStatus: string;
    hasPhone: boolean;
    hasEmail: boolean;
    registrationDate?: string;
  }): { status: string; notes: string; insuranceRelevance: string } {
    const c = (company.caen || '').slice(0, 2);

    let relevance = 'Nevoie de bază: Asigurare de Răspundere Civilă și Protecție Patrimoniu.';
    if (['41', '42', '43'].includes(c)) {
      relevance = 'Constructor All Risks (CAR), Garanții de bună execuție (SEAP), Răspundere Civilă Generală.';
    } else if (['49', '52', '53'].includes(c)) {
      relevance = 'Asigurare CMR, CASCO Flotă Auto Comercială, Asistență Rutieră Extinsă.';
    } else if (['62', '63'].includes(c)) {
      relevance = 'Professional Indemnity (E&O IT), Cyber Risk & Data Breach (cerințe contractuale UE/SUA).';
    } else if (['55', '56'].includes(c)) {
      relevance = 'Proprietate Comercială & Incendiu, Răspundere Civilă Terți (Siguranță Alimentară/Clienți).';
    } else if (['86'].includes(c)) {
      relevance = 'Malpraxis Medical & Clinică Sanitară (Obligație legală conform Legii 95/2006).';
    } else if (['45'].includes(c)) {
      relevance = 'Răspundere Profesională Service Auto, Bunuri Preluate în Pază, Incendiu.';
    }

    if (company.legalStatus === 'ACTIVE' && ['FISCALLY_ACTIVE', 'REACTIVATED'].includes(company.fiscalStatus)) {
      if (company.hasPhone || company.hasEmail) {
        return {
          status: 'POTENTIAL_PROSPECT',
          notes: 'Companie activă juridic și fiscal, cu canal direct de contact identificat.',
          insuranceRelevance: relevance,
        };
      }
      return {
        status: 'RELEVANT_INSURANCE_SEGMENT',
        notes: 'Companie activă în segment eligibil de asigurare. Necesită identificare număr direct.',
        insuranceRelevance: relevance,
      };
    }

    if (company.legalStatus === 'RADIATED' || company.legalStatus === 'SUSPENDED' || company.fiscalStatus === 'FISCALLY_INACTIVE') {
      return {
        status: 'NOT_ELIGIBLE',
        notes: 'Companie exclusă conform statutului legal/fiscal inactiv.',
        insuranceRelevance: 'Neeligibilă pentru prospectare.',
      };
    }

    return {
      status: 'NEW_COMPANY_NOT_ASSESSED',
      notes: 'Companie nou-descoperită în curs de verificare inițială.',
      insuranceRelevance: relevance,
    };
  }

  /**
   * Run the real discovery synchronization pipeline
   */
  static async runSync(options?: {
    batchLimit?: number;
    triggeredBy?: string;
    executionType?: 'SCHEDULED' | 'MANUAL_ADMIN' | 'CLI';
    datasetUrl?: string;
  }): Promise<SyncResult> {
    const startTime = Date.now();
    const nowIso = new Date().toISOString();
    const syncId = `sync_${Date.now()}`;
    const executionType = options?.executionType || 'MANUAL_ADMIN';
    const triggeredBy = options?.triggeredBy || 'system';

    // 0. Verify Database Schema Initialization (Migration 0012 check)
    const schemaCheck = await this.checkSchemaInitialized();
    if (!schemaCheck.initialized) {
      return {
        success: false,
        syncId,
        discoveredCount: 0,
        updatedCount: 0,
        rejectedCount: 0,
        cursorLine: 0,
        message: `Schema bazei de date nu este inițializată pentru monitorizare continuă (lipsesc tabelele: ${schemaCheck.missingTables.join(', ') || 'monitoring_config'}). Este necesară aplicarea migrației 0012 pe Cloudflare D1.`,
        error: 'MIGRATION_REQUIRED',
      };
    }

    // 1. Concurrency Check (atomic lock check)
    const config = await this.getConfig();
    const currentLock = parseInt(config.sync_lock || '0', 10);
    // Lock expires after 10 minutes to prevent deadlocks
    if (currentLock > 0 && Date.now() - currentLock < 10 * 60 * 1000) {
      return {
        success: false,
        syncId,
        discoveredCount: 0,
        updatedCount: 0,
        rejectedCount: 0,
        cursorLine: parseInt(config.stream_cursor_line || '0', 10),
        message: 'O sincronizare este deja în derulare. Vă rugăm să așteptați finalizarea procesului curent.',
        error: 'CONCURRENT_SYNC_LOCKED',
      };
    }

    // Acquire lock
    await this.updateConfigKey('sync_lock', String(Date.now()));
    await this.updateConfigKey('last_attempted_sync_at', nowIso);
    await this.updateConfigKey('last_sync_status', 'RUNNING');

    // Record log entry
    await executeRun(
      `INSERT INTO monitoring_sync_logs (
        sync_id, source_name, source_url, dataset_name, dataset_modified,
        started_at, status, execution_type, triggered_by
      ) VALUES (?, 'ONRC_DATA_GOV', ?, ?, ?, ?, 'RUNNING', ?, ?)`,
      [
        syncId,
        options?.datasetUrl || DEFAULT_ONRC_PACKAGE_URL,
        config.active_package_title || 'ONRC Open Data',
        config.active_package_modified || '',
        nowIso,
        executionType,
        triggeredBy,
      ]
    );

    let discoveredCount = 0;
    let updatedCount = 0;
    let rejectedCount = 0;
    let startCursor = parseInt(config.stream_cursor_line || '0', 10);
    let currentCursor = startCursor;
    const batchLimit = options?.batchLimit || parseInt(config.batch_limit || '50', 10);
    const activationCutoff = config.monitoring_activation_date || '2026-10-01';

    const newCuisForVerification: number[] = [];

    try {
      // 2. Discover package or use stream URL
      const streamUrl = options?.datasetUrl || DEFAULT_ONRC_PACKAGE_URL;
      let res: Response;

      // If fetching from local static assets, use env.ASSETS to avoid Cloudflare loopback 522
      let assetsBinding: any = null;
      try {
        const { getCloudflareContext } = require('@opennextjs/cloudflare');
        const ctx = getCloudflareContext();
        if (ctx?.env?.ASSETS) {
          assetsBinding = ctx.env.ASSETS;
        }
      } catch {}

      if (!assetsBinding) {
        const globalObj = globalThis as any;
        assetsBinding = globalObj.env?.ASSETS || globalObj.__ENV__?.ASSETS;
      }

      if (assetsBinding && streamUrl.includes('/data/onrc_recent_registrations.csv')) {
        res = await assetsBinding.fetch(new Request(streamUrl));
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        res = await fetch(streamUrl, {
          headers: { 'User-Agent': 'RadarBusinessRomania/2.0 (Continuous Company Discovery Engine)' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} la conectarea cu depozitul data.gov.ro (${streamUrl})`);
      }

      if (!res.body) {
        throw new Error('Răspunsul serverului nu conține date (empty body)');
      }

      // Read stream chunk by chunk, accumulating up to batchLimit valid candidate records
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let lineIndex = 0;
      let isHeader = true;

      interface CandidateRecord {
        lineIndex: number;
        cui: number;
        rawName: string;
        rawRegCom: string;
        rawEuid: string;
        rawLegalForm: string;
        rawCountry: string;
        rawCounty: string;
        rawCity: string;
        rawStreet: string;
        rawStreetNr: string;
        rawWebsite: string;
        isoDate: string | null;
      }

      const candidates: CandidateRecord[] = [];
      const effectiveBatchLimit = Math.min(Math.max(1, batchLimit), 25);

      readLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep remainder in buffer

        for (const line of lines) {
          lineIndex++;
          if (lineIndex === 1) {
            isHeader = false;
            continue; // Skip CSV header
          }

          // Resume after cursor if applicable, but wrap around if at EOF
          if (startCursor > 0 && lineIndex <= startCursor) {
            continue;
          }

          currentCursor = lineIndex;

          if (!line.trim()) continue;
          const parts = this.parseCsvLine(line, '^');
          if (parts.length < 4) {
            rejectedCount++;
            continue;
          }

          const rawName = parts[0]?.trim();
          const rawCui = parts[1]?.trim();
          const rawRegCom = parts[2]?.trim();
          const rawDate = parts[3]?.trim();
          const rawEuid = parts[4]?.trim() || '';
          const rawLegalForm = parts[5]?.trim() || '';
          const rawCountry = parts[6]?.trim() || 'România';
          const rawCounty = parts[7]?.trim() || '';
          const rawCity = parts[8]?.trim() || '';
          const rawStreet = parts[9]?.trim() || '';
          const rawStreetNr = parts[10]?.trim() || '';
          const rawWebsite = parts[18]?.trim() || '';

          const cui = parseInt(rawCui, 10);
          if (!cui || cui <= 0 || !rawName) {
            rejectedCount++;
            continue;
          }

          // Parse Date (DD/MM/YYYY HH:MM:SS or DD/MM/YYYY)
          let isoDate: string | null = null;
          if (rawDate.includes('/')) {
            const dateOnly = rawDate.split(' ')[0];
            const dparts = dateOnly.split('/');
            if (dparts.length === 3) {
              isoDate = `${dparts[2]}-${dparts[1].padStart(2, '0')}-${dparts[0].padStart(2, '0')}`;
            }
          } else if (rawDate.includes('-')) {
            isoDate = rawDate.split(' ')[0];
          }

          candidates.push({
            lineIndex,
            cui,
            rawName,
            rawRegCom,
            rawEuid,
            rawLegalForm,
            rawCountry,
            rawCounty,
            rawCity,
            rawStreet,
            rawStreetNr,
            rawWebsite,
            isoDate,
          });

          if (candidates.length >= effectiveBatchLimit) {
            try {
              await reader.cancel();
            } catch {}
            break readLoop;
          }
        }
      }

      // Process candidates in ONE batch to prevent Worker subrequest exhaustion
      if (candidates.length > 0) {
        const candidateCuis = candidates.map((c) => c.cui);
        const placeholders = candidateCuis.map(() => '?').join(',');
        const existingRows = await queryAll<{ cui: number; classification: string }>(
          `SELECT cui, classification FROM companies WHERE cui IN (${placeholders})`,
          candidateCuis
        );
        const existingMap = new Map(existingRows.map((r) => [r.cui, r.classification]));

        const monitoringState = (config.monitoring_state || 'NOT_ACTIVATED') as MonitoringState;
        const activationDate = config.monitoring_activation_date || null;
        const baselineCutoff = config.baseline_backfill_cutoff || '2026-08-15';

        const statements: { sql: string; params: any[] }[] = [];

        for (const cand of candidates) {
          const isExisting = existingMap.has(cand.cui);
          const classification = MonitoringService.classifyCohort(
            cand.isoDate || '',
            monitoringState,
            activationDate,
            isExisting,
            baselineCutoff
          );

          if (isExisting) {
            statements.push({
              sql: `UPDATE companies SET 
                      reg_com = COALESCE(NULLIF(reg_com, ''), ?),
                      euid = COALESCE(NULLIF(euid, ''), ?),
                      legal_form = COALESCE(NULLIF(legal_form, ''), ?),
                      county = COALESCE(NULLIF(county, ''), ?),
                      city = COALESCE(NULLIF(city, ''), ?),
                      registration_date = COALESCE(registration_date, ?),
                      last_observed_at = datetime('now')
                    WHERE cui = ?`,
              params: [cand.rawRegCom, cand.rawEuid, cand.rawLegalForm, cand.rawCounty, cand.rawCity, cand.isoDate, cand.cui],
            });
            updatedCount++;
          } else {
            const derived = this.deriveCaen(cand.rawName, cand.rawLegalForm);
            const qual = this.assessQualification({
              caen: derived.caen,
              legalStatus: 'ACTIVE',
              fiscalStatus: 'UNKNOWN',
              hasPhone: false,
              hasEmail: false,
              registrationDate: cand.isoDate || undefined,
            });

            statements.push({
              sql: `INSERT INTO companies (
                      cui, name, normalized_name, reg_com, euid, legal_form,
                      incorporation_date, registration_date, first_detected_at,
                      country, county, city, street, street_nr, website,
                      primary_caen, caen_description,
                      legal_status, fiscal_status,
                      classification, verification_state, qualification_status, qualification_notes, insurance_relevance,
                      discovery_source, discovery_batch_id,
                      created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'UNKNOWN', ?, 'DISCOVERED', ?, ?, ?, 'ONRC_DATA_GOV', ?, datetime('now'), datetime('now'))`,
              params: [
                cand.cui,
                cand.rawName,
                cand.rawName.toUpperCase(),
                cand.rawRegCom,
                cand.rawEuid,
                cand.rawLegalForm,
                cand.isoDate,
                cand.isoDate,
                nowIso,
                cand.rawCountry,
                cand.rawCounty,
                cand.rawCity,
                cand.rawStreet,
                cand.rawStreetNr,
                cand.rawWebsite || null,
                derived.caen,
                derived.description,
                classification,
                qual.status,
                qual.notes,
                qual.insuranceRelevance,
                syncId,
              ],
            });

            statements.push({
              sql: `INSERT OR IGNORE INTO prospect_pipeline (cui, status, priority, updated_at)
                    VALUES (?, 'NEW_DISCOVERED', 'STANDARD', datetime('now'))`,
              params: [cand.cui],
            });

            const profile = InsuranceIntelligenceService.getProfileForCaen(derived.caen);
            if (profile && profile.recommendedProducts.length > 0) {
              for (const prod of profile.recommendedProducts) {
                statements.push({
                  sql: `INSERT OR IGNORE INTO insurance_opportunities (
                          cui, product_category, product_name, trigger_event,
                          supporting_evidence, rationale, additional_info_needed,
                          confidence_level, estimated_priority
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.85, 'HIGH')`,
                  params: [
                    cand.cui,
                    prod.productCategory,
                    prod.productName,
                    `Înființare companie nouă: ${cand.rawName} (${derived.caen})`,
                    `Activitate declarată în sectorul ${profile.industryName}`,
                    prod.whyRelevant,
                    prod.underwritingCaveat,
                  ],
                });
              }
            }

            discoveredCount++;
            newCuisForVerification.push(cand.cui);
          }
        }

        // Execute all inserts/updates in a single atomic batch query
        await executeBatch(statements);
      }

      // 3. Automatic Immediate ANAF v9 Verification for newly discovered companies (up to 10)
      if (newCuisForVerification.length > 0) {
        try {
          const verifySlice = newCuisForVerification.slice(0, 10);
          const anafResults = await anafConnector.fetchBatchTaxStatus(verifySlice);
          const anafStatements: { sql: string; params: any[] }[] = [];

          for (const item of anafResults) {
            const fiscalStatus = item.statusInactivi
              ? 'FISCALLY_INACTIVE'
              : item.dataReactivare
              ? 'REACTIVATED'
              : 'FISCALLY_ACTIVE';

            let verificationState = 'FISCAL_STATUS_VERIFIED';

            // Insert contacts returned by ANAF
            let hasContact = false;
            for (const contact of item.discoveredContacts) {
              const val = contact.normalizedValue || contact.originalValue;
              if (val) {
                hasContact = true;
                anafStatements.push({
                  sql: `INSERT OR IGNORE INTO contact_records (
                          cui, contact_type, contact_value, normalized_value, label,
                          source_name, verification_status, confidence_score,
                          notes, discovered_at
                        ) VALUES (?, ?, ?, ?, ?, 'ANAF_OPEN_DATA', 'DECLARED_BY_COMPANY', 0.90, 'Număr declarat oficial la administrația fiscală', datetime('now'))`,
                  params: [
                    item.cui,
                    contact.contactType,
                    val,
                    contact.normalizedValue || val,
                    contact.label || 'OFFICIAL',
                  ],
                });
              }
            }

            if (hasContact) {
              verificationState = 'CONTACT_AVAILABLE';
            }

            // Update company with verified fiscal & contact data
            anafStatements.push({
              sql: `UPDATE companies SET 
                      fiscal_status = ?,
                      ro_e_factura = ?,
                      primary_caen = COALESCE(?, primary_caen),
                      verification_state = ?,
                      last_status_check_at = datetime('now'),
                      status_verification_source = 'ANAF_TVA_REST_V9'
                    WHERE cui = ?`,
              params: [fiscalStatus, item.statusRO_e_Factura ? 1 : 0, item.cod_CAEN || null, verificationState, item.cui],
            });

            // Log status evidence
            anafStatements.push({
              sql: `INSERT INTO company_status_evidence (
                      cui, source_name, source_url, query_timestamp, status_returned,
                      verification_method, last_successful_verification, verified_by
                    ) VALUES (?, 'ANAF_TVA_REST_V9', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', datetime('now'), ?, 'API_REST_V9', datetime('now'), 'AUTOMATED_MONITORING')`,
              params: [item.cui, fiscalStatus],
            });
          }

          if (anafStatements.length > 0) {
            await executeBatch(anafStatements);
          }
        } catch (anafErr) {
          console.warn('[MonitoringService] Automatic ANAF enrichment non-blocking error:', anafErr);
        }
      }

      // 4. Update Success Metrics
      const durationMs = Date.now() - startTime;
      const totalDiscovered = parseInt(config.total_discovered_count || '0', 10) + discoveredCount;

      await this.updateConfigKey('stream_cursor_line', String(currentCursor));
      await this.updateConfigKey('last_successful_sync_at', nowIso);
      await this.updateConfigKey('last_sync_status', 'SUCCESS');
      await this.updateConfigKey('total_discovered_count', String(totalDiscovered));
      await this.updateConfigKey('sync_lock', '0');

      // Record first complete continuous activation if not previously activated
      if (config.monitoring_state !== 'CONTINUOUS_DISCOVERY') {
        await this.updateConfigKey('monitoring_state', 'CONTINUOUS_DISCOVERY');
        await this.updateConfigKey('monitoring_activation_date', nowIso);
      }

      await executeRun(
        `UPDATE monitoring_sync_logs SET 
          ended_at = datetime('now'),
          status = 'SUCCESS',
          records_discovered = ?,
          records_updated = ?,
          records_rejected = ?,
          checkpoint_start = ?,
          checkpoint_end = ?
         WHERE sync_id = ?`,
        [discoveredCount, updatedCount, rejectedCount, String(startCursor), String(currentCursor), syncId]
      );

      return {
        success: true,
        syncId,
        discoveredCount,
        updatedCount,
        rejectedCount,
        cursorLine: currentCursor,
        durationMs,
        message: `Sincronizare finalizată cu succes. ${discoveredCount} companii noi descoperite, ${updatedCount} actualizate.`,
      };
    } catch (err: any) {
      const errMsg = err.message || 'Eroare necunoscută la sincronizare';
      const isSourceUnavailable =
        errMsg.includes('ETIMEDOUT') ||
        errMsg.includes('timeout') ||
        errMsg.includes('fetch failed') ||
        errMsg.includes('ECONNREFUSED') ||
        errMsg.includes('ENOTFOUND') ||
        errMsg.includes('502') ||
        errMsg.includes('503') ||
        errMsg.includes('504');

      const failedState: MonitoringState = isSourceUnavailable ? 'SOURCE_UNAVAILABLE' : 'SYNC_FAILED';

      // Release lock and record error
      await this.updateConfigKey('sync_lock', '0');
      await this.updateConfigKey('monitoring_state', failedState);
      await this.updateConfigKey('last_sync_status', failedState);
      await this.updateConfigKey('last_sync_error', errMsg);
      await this.updateConfigKey('last_sync_error', err.message || 'Eroare necunoscută la sincronizare');

      await executeRun(
        `UPDATE monitoring_sync_logs SET 
          ended_at = datetime('now'),
          status = 'FAILED',
          records_discovered = ?,
          records_updated = ?,
          records_rejected = ?,
          error_message = ?
         WHERE sync_id = ?`,
        [discoveredCount, updatedCount, rejectedCount, err.message || 'Eroare necunoscută', syncId]
      );

      return {
        success: false,
        syncId,
        discoveredCount,
        updatedCount,
        rejectedCount,
        cursorLine: currentCursor,
        durationMs: Date.now() - startTime,
        message: `Sincronizare eșuată: ${err.message || 'Eroare necunoscută'}`,
        error: err.message,
      };
    }
  }
}
