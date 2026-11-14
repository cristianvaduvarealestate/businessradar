# DATABASE SCHEMA SPECIFICATION
## RADAR BUSINESS ROMÂNIA — Relational & Full-Text Search Architecture

### 1. Schema Overview

The database is architected for strict referential integrity, CUI deduplication, complete source provenance tracking, and high-performance search across millions of records.

Primary Key Strategy:
- `cui` (Cod Unic de Înregistrare) is the universal fiscal identifier in Romania.
- Synthetic integer `id` auto-increment keys are used for relational speed, with `UNIQUE(cui)` enforced across core tables.
- Secondary multi-year and multi-contact entities use composite foreign keys with cascade constraints.

```
┌────────────────────────────────────────────────────────┐
│                       COMPANIES                        │
│  cui (PK), name, reg_com, euid, status, address, caen  │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┬───────────────────┐
       ▼                   ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  TAX_RECORDS │   │  FINANCIALS  │   │   CONTACTS   │   │ OPPORTUNITIES│
│  vat, split  │   │  rev, profit │   │ email, phone │   │ car, cmr, d&o│
│  e-factura   │   │  employees   │   │   website    │   │  confidence  │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ PROSPECT_PIPELINE │
                 │  stage, follow-up │
                 │   quote, notes    │
                 └───────────────────┘
```

---

### 2. SQL DDL Definitions

```sql
-- 1. COMPANIES (Master Record)
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cui INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT,
    reg_com TEXT,
    euid TEXT,
    legal_form TEXT, -- SRL, SA, PFA, II, IF, SNC, SCS, etc.
    incorporation_date TEXT, -- YYYY-MM-DD
    registration_date TEXT,
    country TEXT DEFAULT 'România',
    county TEXT, -- e.g. 'Bucureşti', 'Cluj', 'Timiş', 'Ilfov'
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
    primary_caen TEXT, -- 4-digit code e.g. '6201'
    caen_description TEXT,
    caen_version TEXT DEFAULT 'Rev.2',
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, RADIATED, SUSPENDED, INSOLVENCY, DISSOLVED
    status_code TEXT,
    website TEXT,
    parent_company_country TEXT,
    first_observed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_observed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_verified_at DATETIME,
    data_completeness_score REAL DEFAULT 0.0,
    opportunity_score REAL DEFAULT 0.0,
    financial_trend TEXT DEFAULT 'UNKNOWN', -- GROWING, STABLE, DECLINING, UNKNOWN
    prospect_priority TEXT DEFAULT 'STANDARD', -- LOW, STANDARD, HIGH, URGENT
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_companies_cui ON companies(cui);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(normalized_name);
CREATE INDEX IF NOT EXISTS idx_companies_county ON companies(county);
CREATE INDEX IF NOT EXISTS idx_companies_caen ON companies(primary_caen);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_inc_date ON companies(incorporation_date);
CREATE INDEX IF NOT EXISTS idx_companies_first_obs ON companies(first_observed_at);
CREATE INDEX IF NOT EXISTS idx_companies_opp_score ON companies(opportunity_score DESC);

-- 2. FULL-TEXT SEARCH VIRTUAL TABLE (FTS5)
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

-- 3. SECONDARY CAEN CODES
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

-- 4. TAX RECORDS (ANAF Integration)
CREATE TABLE IF NOT EXISTS tax_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cui INTEGER UNIQUE NOT NULL,
    vat_registered INTEGER DEFAULT 0,
    vat_start_date TEXT,
    vat_end_date TEXT,
    vat_collection_regime INTEGER DEFAULT 0, -- TVA la încasare
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

-- 5. FINANCIAL RECORDS (Ministry of Finance Multi-Year Statements)
CREATE TABLE IF NOT EXISTS financial_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cui INTEGER NOT NULL,
    fiscal_year INTEGER NOT NULL,
    turnover REAL, -- Cifra de afaceri netă
    total_revenues REAL, -- Venituri totale
    gross_profit REAL, -- Profit brut
    net_profit REAL, -- Profit net
    net_loss REAL, -- Pierdere netă
    total_assets REAL, -- Active totale
    fixed_assets REAL, -- Active imobilizate
    current_assets REAL, -- Active circulante
    total_liabilities REAL, -- Datorii totale
    equity REAL, -- Capitaluri proprii
    share_capital REAL, -- Capital social
    employees_avg INTEGER, -- Număr mediu de salariați
    filing_date TEXT,
    source TEXT DEFAULT 'MIN_FIN',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE,
    UNIQUE(cui, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_financials_cui_year ON financial_records(cui, fiscal_year DESC);

-- 6. CONTACT RECORDS
CREATE TABLE IF NOT EXISTS contact_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cui INTEGER NOT NULL,
    contact_type TEXT NOT NULL, -- EMAIL, PHONE, WEBSITE, FORM_URL, ADDRESS
    contact_value TEXT NOT NULL,
    label TEXT DEFAULT 'OFFICE', -- OFFICE, SALES, COMMERCIAL, HEADQUARTERS
    provenance_url TEXT,
    verification_status TEXT DEFAULT 'PUBLIC_UNVERIFIED', -- VERIFIED, PUBLIC_UNVERIFIED, INVALID, CONFIRMED
    confidence_score REAL DEFAULT 0.5,
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_checked_at DATETIME,
    FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE,
    UNIQUE(cui, contact_type, contact_value)
);

CREATE INDEX IF NOT EXISTS idx_contacts_cui ON contact_records(cui);

-- 7. INSURANCE OPPORTUNITY INTELLIGENCE
CREATE TABLE IF NOT EXISTS insurance_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cui INTEGER NOT NULL,
    product_category TEXT NOT NULL, -- PROPERTY, LIABILITY, CONSTRUCTION, TRANSPORT, IT_CYBER, HEALTHCARE, HOSPITALITY, EMPLOYEE_BENEFITS, ENGINEERING
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

-- 8. PROSPECT PIPELINE (CRM)
CREATE TABLE IF NOT EXISTS prospect_pipeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cui INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'NEW_DISCOVERED',
    priority TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
    assigned_to TEXT,
    next_follow_up_date TEXT,
    products_discussed TEXT,
    quotation_amount REAL,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cui) REFERENCES companies(cui) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pipeline_status ON prospect_pipeline(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_followup ON prospect_pipeline(next_follow_up_date);

-- 9. SUPPRESSION LIST (DO NOT CONTACT)
CREATE TABLE IF NOT EXISTS suppression_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cui INTEGER UNIQUE,
    domain TEXT,
    email TEXT,
    phone TEXT,
    reason TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. INGESTION JOBS & EXECUTION AUDIT
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL,
    scheduled_at DATETIME NOT NULL,
    started_at DATETIME,
    ended_at DATETIME,
    status TEXT NOT NULL, -- PENDING, RUNNING, SUCCESS, PARTIAL_SUCCESS, FAILED, SKIPPED, NO_NEW_DATA
    records_processed INTEGER DEFAULT 0,
    new_records INTEGER DEFAULT 0,
    updated_records INTEGER DEFAULT 0,
    duplicate_records INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    checkpoint TEXT,
    duration_ms INTEGER,
    error_log TEXT
);

-- 11. TELEGRAM DISPATCH LOG
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

-- 12. DATA PROVENANCE & CHANGE HISTORY
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
```
