-- Migration 0008: Company Legal Status, Fiscal Status, Commercial Evidence & Calling Eligibility
-- Preserves all existing tables, rows, contacts, CRM interactions, follow-ups and history.

ALTER TABLE companies ADD COLUMN legal_status TEXT DEFAULT 'UNKNOWN';
ALTER TABLE companies ADD COLUMN legal_status_desc TEXT;
ALTER TABLE companies ADD COLUMN legal_status_date TEXT;
ALTER TABLE companies ADD COLUMN fiscal_status TEXT DEFAULT 'UNKNOWN';
ALTER TABLE companies ADD COLUMN fiscal_inactivation_date TEXT;
ALTER TABLE companies ADD COLUMN fiscal_reactivation_date TEXT;
ALTER TABLE companies ADD COLUMN ro_e_factura INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN commercial_evidence_status TEXT DEFAULT 'COMMERCIAL_ACTIVITY_UNKNOWN';
ALTER TABLE companies ADD COLUMN latest_financial_year INTEGER;
ALTER TABLE companies ADD COLUMN turnover REAL;
ALTER TABLE companies ADD COLUMN employees_avg INTEGER;
ALTER TABLE companies ADD COLUMN net_profit REAL;
ALTER TABLE companies ADD COLUMN net_loss REAL;
ALTER TABLE companies ADD COLUMN is_calling_eligible INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN ineligibility_reasons TEXT;
ALTER TABLE companies ADD COLUMN last_status_check_at DATETIME;
ALTER TABLE companies ADD COLUMN status_verification_source TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_calling_eligible ON companies(is_calling_eligible);
CREATE INDEX IF NOT EXISTS idx_companies_legal_status ON companies(legal_status);
CREATE INDEX IF NOT EXISTS idx_companies_fiscal_status ON companies(fiscal_status);
CREATE INDEX IF NOT EXISTS idx_companies_comm_evidence ON companies(commercial_evidence_status);
