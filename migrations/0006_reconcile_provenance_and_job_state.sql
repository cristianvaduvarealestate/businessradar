-- migrations/0006_reconcile_provenance_and_job_state.sql

-- 1. Add contact checking tracking columns to companies if not existing
ALTER TABLE companies ADD COLUMN contact_checked_at DATETIME;
ALTER TABLE companies ADD COLUMN contact_check_status TEXT DEFAULT 'UNCHECKED';
ALTER TABLE companies ADD COLUMN contact_check_sources TEXT;

-- 2. Create durable job state tracking table for Phase 4
CREATE TABLE IF NOT EXISTS enrichment_job_state (
    id TEXT PRIMARY KEY,
    total_companies INTEGER DEFAULT 0,
    companies_checked INTEGER DEFAULT 0,
    companies_remaining INTEGER DEFAULT 0,
    companies_with_contact INTEGER DEFAULT 0,
    companies_without_contact INTEGER DEFAULT 0,
    new_mobiles INTEGER DEFAULT 0,
    new_landlines INTEGER DEFAULT 0,
    new_emails INTEGER DEFAULT 0,
    new_websites INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    rate_limited_requests INTEGER DEFAULT 0,
    last_processed_cui INTEGER DEFAULT 0,
    last_batch_at DATETIME,
    status TEXT DEFAULT 'IDLE',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Downgrade historical unverified website claims and assign exact provenance
UPDATE contact_records 
SET source_name = 'HISTORICAL_REGISTRY',
    provenance_url = 'data/onrc_real_stream.csv',
    verification_status = 'UNVERIFIED',
    confidence_score = 0.40
WHERE provenance_url IS NULL AND contact_type = 'WEBSITE';

-- 4. Mark known unreachable/dead historical domains
UPDATE contact_records 
SET verification_status = 'UNREACHABLE_DOMAIN',
    confidence_score = 0.0
WHERE cui IN (25962868, 19209904) AND contact_type = 'WEBSITE' AND source_name = 'HISTORICAL_REGISTRY';

-- 5. Delete redundant unverified duplicate rows where a verified official website exists
DELETE FROM contact_records 
WHERE id IN (9, 6); -- ID 9 is redundant for Krommax, ID 6 is redundant for Cibernet

-- 6. Correct provenance path for ANANDA GARDENS and ALGIDA CENTER
UPDATE contact_records
SET provenance_url = 'data/onrc_real_stream.csv',
    notes = 'Număr telefon extras din evidențele oficiale inițiale (câmpul WEB corectat)'
WHERE id = 20;

UPDATE contact_records
SET provenance_url = 'data/onrc_real_stream.csv',
    notes = 'Adresă email corectată din formatul eronat www.ofice@algida.ro din evidențele inițiale'
WHERE id = 21;

-- 7. Initialize job state
INSERT OR REPLACE INTO enrichment_job_state (
    id, total_companies, companies_checked, companies_remaining,
    companies_with_contact, companies_without_contact,
    new_mobiles, new_landlines, new_emails, new_websites,
    failed_requests, rate_limited_requests, last_processed_cui,
    last_batch_at, status, updated_at
) VALUES (
    'BULK_ENRICHMENT_JOB', 2908, 0, 2908,
    0, 0,
    0, 0, 0, 0,
    0, 0, 0,
    NULL, 'IDLE', CURRENT_TIMESTAMP
);
