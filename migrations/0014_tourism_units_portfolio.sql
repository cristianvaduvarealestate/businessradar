-- 0014_tourism_units_portfolio.sql
-- Add specialized columns for national classified tourism units portfolio (UNITĂȚI TURISTICE)

ALTER TABLE prospect_records ADD COLUMN unit_type TEXT;
ALTER TABLE prospect_records ADD COLUMN unit_name TEXT;
ALTER TABLE prospect_records ADD COLUMN unit_classification TEXT;
ALTER TABLE prospect_records ADD COLUMN rooms_count TEXT;
ALTER TABLE prospect_records ADD COLUMN beds_count TEXT;
ALTER TABLE prospect_records ADD COLUMN locality_type TEXT;
ALTER TABLE prospect_records ADD COLUMN locality_subdivision TEXT;
ALTER TABLE prospect_records ADD COLUMN operator_type TEXT;
ALTER TABLE prospect_records ADD COLUMN operator_name TEXT;
ALTER TABLE prospect_records ADD COLUMN authorization_number TEXT;
ALTER TABLE prospect_records ADD COLUMN authorization_date TEXT;

CREATE INDEX IF NOT EXISTS idx_prospect_unit_type ON prospect_records(unit_type);
CREATE INDEX IF NOT EXISTS idx_prospect_operator_name ON prospect_records(operator_name);
