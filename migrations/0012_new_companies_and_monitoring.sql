-- Migration 0012: Continuous New Company Discovery, Monitoring Config & Verification Workflow
-- Preserves all existing 2,908 historical companies, contacts, CRM interactions and evidence.

-- 1. Add classification and discovery tracking to companies
ALTER TABLE companies ADD COLUMN classification TEXT DEFAULT 'HISTORICAL';
ALTER TABLE companies ADD COLUMN first_detected_at TEXT;
ALTER TABLE companies ADD COLUMN verification_state TEXT DEFAULT 'DISCOVERED';
ALTER TABLE companies ADD COLUMN qualification_status TEXT DEFAULT 'NEW_COMPANY_NOT_ASSESSED';
ALTER TABLE companies ADD COLUMN qualification_notes TEXT;
ALTER TABLE companies ADD COLUMN insurance_relevance TEXT;
ALTER TABLE companies ADD COLUMN discovery_source TEXT DEFAULT 'HISTORICAL_DATABASE';
ALTER TABLE companies ADD COLUMN discovery_batch_id TEXT;

-- 2. Indexes for discovery, classification and qualification queries
CREATE INDEX IF NOT EXISTS idx_companies_classification ON companies(classification);
CREATE INDEX IF NOT EXISTS idx_companies_first_detected ON companies(first_detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_registration_date ON companies(registration_date DESC);
CREATE INDEX IF NOT EXISTS idx_companies_verification_state ON companies(verification_state);
CREATE INDEX IF NOT EXISTS idx_companies_qualification ON companies(qualification_status);

-- 3. Monitoring Configuration Table
CREATE TABLE IF NOT EXISTS monitoring_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO monitoring_config (key, value, description) VALUES
('monitoring_status', 'STANDBY', 'Current operational status of automated company monitoring (ACTIVE, STANDBY, PAUSED)'),
('monitoring_activation_date', '2026-10-01', 'Cutoff date for new company classification (registration_date >= cutoff => NEW)'),
('auto_sync_enabled', 'true', 'Whether scheduled synchronization is enabled'),
('cron_schedule', '0 6 * * *', 'Daily cron schedule expression (UTC)'),
('batch_limit', '50', 'Number of new companies to process per sync run'),
('active_source', 'ONRC_DATA_GOV', 'Active data source identifier'),
('active_source_url', 'https://data.gov.ro/api/3/action', 'Source API endpoint'),
('active_package_id', 'c2c88c9d-4824-45f1-90ec-656f1c0d8785', 'CKAN package ID for latest ONRC dataset'),
('active_package_title', 'Firme înregistrate la Registrul Comerțului până la data de 04.11.2026', 'Title of latest ONRC dataset'),
('active_package_modified', '2026-11-06T05:19:37.832084', 'Publication timestamp of latest dataset'),
('stream_cursor_line', '0', 'Line cursor for streaming pagination'),
('sync_lock', '0', 'Concurrency lock timestamp (0 = unlocked)'),
('last_successful_sync_at', '', 'Timestamp of last successful synchronization run'),
('last_attempted_sync_at', '', 'Timestamp of last attempted synchronization run'),
('last_sync_status', 'WAITING_FIRST_SYNC', 'Status of last sync (WAITING_FIRST_SYNC, SUCCESS, FAILED, RUNNING)'),
('last_sync_error', '', 'Error message from last failed sync, if any'),
('total_discovered_count', '0', 'Total number of newly discovered companies via monitoring');

-- 4. Monitoring Sync Execution Log Table
CREATE TABLE IF NOT EXISTS monitoring_sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_id TEXT UNIQUE NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  dataset_name TEXT,
  dataset_modified TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,
  records_discovered INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_rejected INTEGER DEFAULT 0,
  checkpoint_start TEXT,
  checkpoint_end TEXT,
  error_message TEXT,
  execution_type TEXT DEFAULT 'SCHEDULED',
  triggered_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON monitoring_sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON monitoring_sync_logs(status);

-- 5. Ingestion Nonces Table for HMAC Anti-Replay Protection
CREATE TABLE IF NOT EXISTS ingestion_nonces (
  nonce TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nonces_timestamp ON ingestion_nonces(timestamp);

-- 6. Backfill historical records metadata
-- Copy incorporation_date to registration_date where registration_date is NULL
UPDATE companies SET registration_date = incorporation_date WHERE registration_date IS NULL AND incorporation_date IS NOT NULL;
-- Set first_detected_at to first_observed_at for all historical records
UPDATE companies SET first_detected_at = first_observed_at WHERE first_detected_at IS NULL;
-- Ensure all existing records are marked HISTORICAL
UPDATE companies SET classification = 'HISTORICAL' WHERE classification IS NULL OR classification = '';
