import { getEdgeDatabase } from './edge-db';
import { getCloudflareContext } from '@opennextjs/cloudflare';

let dbInstance: any = null;

export function getD1Database(): any | null {
  try {
    const ctx = getCloudflareContext();
    const env = ctx?.env as any;
    if (env && env.DB) {
      return env.DB;
    }
  } catch {
    // Expected outside Cloudflare Workers execution context
  }
  return null;
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const d1 = getD1Database();
  if (d1) {
    const stmt = params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql);
    const res = await stmt.all();
    return (res.results || []) as T[];
  }
  const db = getDatabase();
  if (db && typeof db.prepare === 'function') {
    const res = db.prepare(sql).all(...params);
    return (res || []) as T[];
  }
  return [];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const d1 = getD1Database();
  if (d1) {
    const stmt = params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql);
    const res = await stmt.first();
    return (res || null) as T | null;
  }
  const db = getDatabase();
  if (db && typeof db.prepare === 'function') {
    const res = db.prepare(sql).get(...params);
    return (res || null) as T | null;
  }
  return null;
}

export async function executeRun(
  sql: string,
  params: any[] = []
): Promise<{ success: boolean; changes: number; lastInsertRowid?: any }> {
  const d1 = getD1Database();
  if (d1) {
    const stmt = params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql);
    const res = await stmt.run();
    return {
      success: res.success !== false,
      changes: res.meta?.changes ?? 1,
      lastInsertRowid: res.meta?.last_row_id,
    };
  }
  const db = getDatabase();
  if (db && typeof db.prepare === 'function') {
    const res = db.prepare(sql).run(...params);
    return {
      success: true,
      changes: res.changes ?? 1,
      lastInsertRowid: res.lastInsertRowid,
    };
  }
  return { success: false, changes: 0 };
}

export async function executeBatch(
  statements: { sql: string; params?: any[] }[]
): Promise<{ success: boolean; changes: number }> {
  if (!statements || statements.length === 0) return { success: true, changes: 0 };
  const d1 = getD1Database();
  if (d1) {
    const stmts = statements.map((s) =>
      s.params && s.params.length > 0 ? d1.prepare(s.sql).bind(...s.params) : d1.prepare(s.sql)
    );
    const results = await d1.batch(stmts);
    const totalChanges = results.reduce((acc: number, r: any) => acc + (r.meta?.changes ?? 0), 0);
    return { success: true, changes: totalChanges };
  }
  const db = getDatabase();
  if (db && typeof db.prepare === 'function') {
    const runInTransaction = db.transaction((stmts: any[]) => {
      let changes = 0;
      for (const s of stmts) {
        const res = db.prepare(s.sql).run(...(s.params || []));
        changes += res.changes ?? 0;
      }
      return changes;
    });
    const changes = runInTransaction(statements);
    return { success: true, changes };
  }
  return { success: false, changes: 0 };
}

function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.release?.name === 'node' &&
    !process.env.NEXT_RUNTIME &&
    typeof (globalThis as any).WebSocketPair === 'undefined'
  );
}

export function getDatabase(): any {
  if (dbInstance) return dbInstance;

  if (isNodeEnvironment()) {
    try {
      // Dynamically require Node-only modules
      const Database = require('better-sqlite3');
      const path = require('path');
      const fs = require('fs');

      const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'radar_business.db');
      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const db = new Database(DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('foreign_keys = ON');
      db.pragma('cache_size = -64000');
      db.pragma('temp_store = MEMORY');

      initSchema(db);
      dbInstance = db;
      return dbInstance;
    } catch (err) {
      console.warn('Native SQLite unavailable, using Edge Database adapter:', err);
      dbInstance = getEdgeDatabase();
      return dbInstance;
    }
  }

  // Edge / Cloudflare Workers environment
  dbInstance = getEdgeDatabase();
  return dbInstance;
}

export function initSchema(db: any) {
  if (!db || typeof db.exec !== 'function') return;

  db.exec(`
    -- 1. Master Companies Table
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT,
      reg_com TEXT,
      euid TEXT,
      legal_form TEXT,
      incorporation_date TEXT,
      registration_date TEXT,
      country TEXT DEFAULT 'România',
      county TEXT,
      city TEXT,
      street TEXT,
      street_nr TEXT,
      building TEXT,
      stair TEXT,
      floor TEXT,
      apartment TEXT,
      postal_code TEXT,
      sector TEXT,
      address_details TEXT,
      primary_caen TEXT,
      caen_description TEXT,
      caen_version TEXT DEFAULT 'Rev.2',
      status TEXT DEFAULT 'ACTIVE',
      status_code TEXT,
      website TEXT,
      parent_company_country TEXT,
      first_observed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_observed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_verified_at DATETIME,
      data_completeness_score REAL DEFAULT 0.0,
      opportunity_score REAL DEFAULT 0.0,
      financial_trend TEXT DEFAULT 'UNKNOWN',
      prospect_priority TEXT DEFAULT 'STANDARD',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_companies_cui ON companies(cui);
    CREATE INDEX IF NOT EXISTS idx_companies_county ON companies(county);
    CREATE INDEX IF NOT EXISTS idx_companies_caen ON companies(primary_caen);
    CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
    CREATE INDEX IF NOT EXISTS idx_companies_inc_date ON companies(incorporation_date);
    CREATE INDEX IF NOT EXISTS idx_companies_first_obs ON companies(first_observed_at);
    CREATE INDEX IF NOT EXISTS idx_companies_opp_score ON companies(opportunity_score DESC);

    -- 2. Full-Text Search Virtual Table
    CREATE VIRTUAL TABLE IF NOT EXISTS companies_fts USING fts5(
      name,
      cui UNINDEXED,
      reg_com UNINDEXED,
      county,
      city,
      caen_description,
      content='companies',
      content_rowid='id'
    );

    -- 3. Secondary CAEN Codes
    CREATE TABLE IF NOT EXISTS company_secondary_caen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER NOT NULL,
      caen_code TEXT NOT NULL,
      caen_version TEXT DEFAULT 'Rev.2',
      authorized INTEGER DEFAULT 1,
      FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE,
      UNIQUE(cui, caen_code)
    );

    CREATE INDEX IF NOT EXISTS idx_sec_caen_code ON company_secondary_caen(caen_code);

    -- 4. Tax Records (ANAF)
    CREATE TABLE IF NOT EXISTS tax_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER UNIQUE NOT NULL,
      vat_registered INTEGER DEFAULT 0,
      vat_start_date TEXT,
      vat_end_date TEXT,
      vat_collection_regime INTEGER DEFAULT 0,
      split_vat INTEGER DEFAULT 0,
      taxpayer_active INTEGER DEFAULT 1,
      inactivity_start_date TEXT,
      reactivation_date TEXT,
      e_factura_registered INTEGER DEFAULT 0,
      fiscal_domicile TEXT,
      iban TEXT,
      verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      raw_response TEXT,
      source TEXT DEFAULT 'ANAF',
      FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE
    );

    -- 5. Financial Records (Ministry of Finance Multi-Year)
    CREATE TABLE IF NOT EXISTS financial_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER NOT NULL,
      fiscal_year INTEGER NOT NULL,
      turnover REAL,
      total_revenues REAL,
      gross_profit REAL,
      net_profit REAL,
      net_loss REAL,
      total_assets REAL,
      fixed_assets REAL,
      current_assets REAL,
      total_liabilities REAL,
      equity REAL,
      share_capital REAL,
      employees_avg INTEGER,
      filing_date TEXT,
      source TEXT DEFAULT 'MIN_FIN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE,
      UNIQUE(cui, fiscal_year)
    );

    CREATE INDEX IF NOT EXISTS idx_financials_cui_year ON financial_records(cui, fiscal_year DESC);

    -- 6. Contact Records
    CREATE TABLE IF NOT EXISTS contact_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER NOT NULL,
      contact_type TEXT NOT NULL,
      contact_value TEXT NOT NULL,
      normalized_value TEXT,
      label TEXT DEFAULT 'OFFICE',
      source_name TEXT,
      provenance_url TEXT,
      verification_method TEXT,
      verification_status TEXT DEFAULT 'PUBLIC_UNVERIFIED',
      confidence_score REAL DEFAULT 0.5,
      contact_person TEXT,
      contact_person_position TEXT,
      notes TEXT,
      discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_checked_at DATETIME,
      FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE,
      UNIQUE(cui, contact_type, contact_value)
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_cui ON contact_records(cui);

    -- 7. Insurance Opportunity Intelligence
    CREATE TABLE IF NOT EXISTS insurance_opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER NOT NULL,
      product_category TEXT NOT NULL,
      product_name TEXT NOT NULL,
      trigger_event TEXT NOT NULL,
      supporting_evidence TEXT NOT NULL,
      rationale TEXT NOT NULL,
      additional_info_needed TEXT,
      confidence_level REAL DEFAULT 0.8,
      estimated_priority TEXT DEFAULT 'HIGH',
      manually_reviewed INTEGER DEFAULT 0,
      review_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE,
      UNIQUE(cui, product_name)
    );

    CREATE INDEX IF NOT EXISTS idx_opp_cui ON insurance_opportunities(cui);
    CREATE INDEX IF NOT EXISTS idx_opp_category ON insurance_opportunities(product_category);

    -- 8. Prospect Pipeline (CRM)
    CREATE TABLE IF NOT EXISTS prospect_pipeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER UNIQUE NOT NULL,
      status TEXT DEFAULT 'NEW',
      priority TEXT DEFAULT 'STANDARD',
      assigned_to TEXT,
      next_follow_up_date TEXT,
      products_discussed TEXT,
      quotation_amount REAL,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pipeline_status ON prospect_pipeline(status);

    -- 8b. CRM Interactions Log
    CREATE TABLE IF NOT EXISTS crm_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER NOT NULL,
      interaction_type TEXT NOT NULL,
      outcome TEXT NOT NULL,
      notes TEXT NOT NULL,
      contact_person TEXT,
      contact_value TEXT,
      next_action TEXT,
      next_follow_up_date TEXT,
      user_responsible TEXT DEFAULT 'myremaxclubcristianv@gmail.com',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_crm_interactions_cui ON crm_interactions(cui);
    CREATE INDEX IF NOT EXISTS idx_crm_interactions_created ON crm_interactions(created_at DESC);

    -- 8c. CRM Follow-Up Tasks
    CREATE TABLE IF NOT EXISTS crm_follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      priority TEXT DEFAULT 'MEDIUM',
      status TEXT DEFAULT 'PENDING',
      completed_at DATETIME,
      completed_by TEXT,
      created_by TEXT DEFAULT 'myremaxclubcristianv@gmail.com',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_crm_follow_ups_cui ON crm_follow_ups(cui);
    CREATE INDEX IF NOT EXISTS idx_crm_follow_ups_due ON crm_follow_ups(due_date);
    CREATE INDEX IF NOT EXISTS idx_crm_follow_ups_status ON crm_follow_ups(status);

    -- 8d. CRM Status Change History
    CREATE TABLE IF NOT EXISTS crm_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      reason TEXT,
      changed_by TEXT DEFAULT 'myremaxclubcristianv@gmail.com',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_crm_status_hist_cui ON crm_status_history(cui);

    -- 9. Suppression List (DO NOT CONTACT)
    CREATE TABLE IF NOT EXISTS suppression_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER UNIQUE,
      domain TEXT,
      email TEXT,
      phone TEXT,
      reason TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Ingestion Jobs
    CREATE TABLE IF NOT EXISTS ingestion_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT UNIQUE NOT NULL,
      provider TEXT NOT NULL,
      scheduled_at DATETIME NOT NULL,
      started_at DATETIME,
      ended_at DATETIME,
      status TEXT NOT NULL,
      records_processed INTEGER DEFAULT 0,
      new_records INTEGER DEFAULT 0,
      updated_records INTEGER DEFAULT 0,
      duplicate_records INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      checkpoint TEXT,
      duration_ms INTEGER,
      error_log TEXT
    );

    -- 11. Telegram Dispatch Log
    CREATE TABLE IF NOT EXISTS telegram_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_type TEXT NOT NULL,
      payload_hash TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      sent_at DATETIME,
      telegram_message_id TEXT,
      retry_count INTEGER DEFAULT 0,
      error_message TEXT
    );

    -- 12. Audit Log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cui INTEGER NOT NULL,
      entity_table TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      source TEXT NOT NULL,
      confidence REAL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export default getDatabase;
