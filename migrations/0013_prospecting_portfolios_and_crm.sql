-- 0013_prospecting_portfolios_and_crm.sql
-- Dedicated tables for the two prospecting portfolios and individual CRM dossiers

CREATE TABLE IF NOT EXISTS prospect_records (
    id TEXT PRIMARY KEY,
    portfolio_type TEXT NOT NULL, -- 'GENERAL' or 'NICHE_HORECA_AUTO_CONSTRUCT'
    source_file TEXT NOT NULL,
    source_row_index INTEGER,
    raw_content TEXT,
    company_name TEXT NOT NULL,
    cui TEXT,
    reg_com TEXT,
    domain TEXT,
    county TEXT,
    city TEXT,
    address TEXT,
    phones TEXT, -- JSON array of phone strings
    emails TEXT, -- JSON array of email strings
    website TEXT,
    contact_persons TEXT,
    initial_notes TEXT,
    verification_note TEXT,
    insurance_suggestions TEXT,
    confirmed_interested_products TEXT, -- JSON array of selected insurance categories
    commercial_status TEXT NOT NULL DEFAULT 'NEW_UNVERIFIED',
    decision_maker TEXT,
    operational_notes TEXT,
    is_incomplete INTEGER NOT NULL DEFAULT 0,
    matched_cui TEXT, -- Foreign lookup reference to companies(cui)
    matched_company_name TEXT,
    is_potential_duplicate INTEGER NOT NULL DEFAULT 0,
    next_callback_date TEXT, -- YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
    next_action TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prospect_portfolio ON prospect_records(portfolio_type);
CREATE INDEX IF NOT EXISTS idx_prospect_status ON prospect_records(commercial_status);
CREATE INDEX IF NOT EXISTS idx_prospect_callback ON prospect_records(next_callback_date);
CREATE INDEX IF NOT EXISTS idx_prospect_cui ON prospect_records(cui);
CREATE INDEX IF NOT EXISTS idx_prospect_name ON prospect_records(company_name);
CREATE INDEX IF NOT EXISTS idx_prospect_county ON prospect_records(county);

CREATE TABLE IF NOT EXISTS prospect_discussions (
    id TEXT PRIMARY KEY,
    prospect_id TEXT NOT NULL REFERENCES prospect_records(id) ON DELETE CASCADE,
    interaction_date TEXT NOT NULL,
    interaction_type TEXT NOT NULL, -- CALL, EMAIL, MEETING, OFFER_SENT, SCHEDULED_CALLBACK
    contact_person TEXT,
    discussion_summary TEXT NOT NULL,
    interested_products TEXT,
    requested_documents TEXT,
    offer_to_prepare TEXT,
    outcome TEXT,
    next_step TEXT,
    next_callback_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prospect_discussions_prospect ON prospect_discussions(prospect_id, interaction_date DESC);
