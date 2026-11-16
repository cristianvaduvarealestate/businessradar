-- Migration 0010: Company Status Evidence & ONRC Manual Verification Workflow
-- Creates persistent audit trail for every verification query (ANAF, ONRC, Financials)
-- Adds explicit ONRC verification columns to preserve strict separation between ANAF and ONRC evidence.

CREATE TABLE IF NOT EXISTS company_status_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cui INTEGER NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    query_timestamp TEXT NOT NULL,
    response_timestamp TEXT,
    status_returned TEXT NOT NULL,
    effective_date TEXT,
    verification_method TEXT NOT NULL,
    raw_response_ref TEXT,
    last_successful_verification TEXT,
    next_verification_due TEXT,
    provider_error TEXT,
    verified_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (cui) REFERENCES companies(cui)
);

CREATE INDEX IF NOT EXISTS idx_status_evidence_cui ON company_status_evidence(cui, query_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_status_evidence_source ON company_status_evidence(source_name, query_timestamp DESC);

-- Add explicit ONRC audit columns to companies
ALTER TABLE companies ADD COLUMN onrc_status TEXT DEFAULT 'ONRC_UNVERIFIED';
ALTER TABLE companies ADD COLUMN onrc_status_date TEXT;
ALTER TABLE companies ADD COLUMN onrc_verified_at TEXT;
ALTER TABLE companies ADD COLUMN onrc_verification_notes TEXT;
ALTER TABLE companies ADD COLUMN onrc_verified_by TEXT;
ALTER TABLE companies ADD COLUMN financial_source TEXT;
ALTER TABLE companies ADD COLUMN financial_reporting_year INTEGER;
ALTER TABLE companies ADD COLUMN financial_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_onrc_status ON companies(onrc_status);
