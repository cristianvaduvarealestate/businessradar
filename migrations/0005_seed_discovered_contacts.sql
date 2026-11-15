-- 0005_seed_discovered_contacts.sql: Sync enriched contacts into Cloudflare D1
-- Correct historical malformed websites
UPDATE companies SET website = NULL WHERE cui = 33898294;
UPDATE companies SET website = NULL WHERE cui = 15848999;
DELETE FROM contact_records WHERE cui = 15848999 AND contact_value LIKE '%ofice@algida.ro%';

-- Insert enriched contact records
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    10503468, 'WEBSITE', 'WWW.JANTO.RO', NULL, 'OFFICE',
    NULL, NULL, NULL, 'VERIFIED',
    0.95, NULL, NULL, NULL,
    '2026-11-14 16:15:12', NULL
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    25962868, 'WEBSITE', 'www.pascalini.eu', NULL, 'OFFICE',
    NULL, NULL, NULL, 'VERIFIED',
    0.95, NULL, NULL, NULL,
    '2026-11-14 16:15:12', NULL
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    15494182, 'WEBSITE', 'www.gradinvest.ro', NULL, 'OFFICE',
    NULL, NULL, NULL, 'VERIFIED',
    0.95, NULL, NULL, NULL,
    '2026-11-14 16:15:12', NULL
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    19209904, 'WEBSITE', 'www.pensiuneaverde.ro', NULL, 'OFFICE',
    NULL, NULL, NULL, 'VERIFIED',
    0.95, NULL, NULL, NULL,
    '2026-11-14 16:15:12', NULL
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    15433290, 'WEBSITE', 'www.stimservice.ro', NULL, 'OFFICE',
    NULL, NULL, NULL, 'VERIFIED',
    0.95, NULL, NULL, NULL,
    '2026-11-14 16:15:12', NULL
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    21457545, 'WEBSITE', 'www.cibernetservice.ro', NULL, 'OFFICE',
    NULL, NULL, NULL, 'VERIFIED',
    0.95, NULL, NULL, NULL,
    '2026-11-14 16:15:12', NULL
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    22619173, 'WEBSITE', 'www.visualcom.ro', NULL, 'OFFICE',
    NULL, NULL, NULL, 'VERIFIED',
    0.95, NULL, NULL, NULL,
    '2026-11-14 16:15:12', NULL
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    28094374, 'WEBSITE', 'www.krommax.ro', NULL, 'OFFICE',
    NULL, NULL, NULL, 'VERIFIED',
    0.95, NULL, NULL, NULL,
    '2026-11-14 16:15:12', NULL
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    1868287, 'WEBSITE', 'www.comcm.ro', NULL, 'OFFICE',
    NULL, NULL, NULL, 'VERIFIED',
    0.95, NULL, NULL, NULL,
    '2026-11-14 16:15:12', NULL
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    33898294, 'MOBILE', '0744700293', '+40744700293', 'COMMERCIAL',
    'HISTORICAL_REGISTRY', 'data/radar_business.db', 'REGISTRY_FIELD_EXTRACTION', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Număr mobil extras din evidențele companiei (corectat din câmpul website)',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    15848999, 'EMAIL', 'office@algida.ro', 'office@algida.ro', 'OFFICE',
    'HISTORICAL_REGISTRY', 'data/radar_business.db', 'REGISTRY_FIELD_EXTRACTION', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Adresă email corectată din formatul eronat www.ofice@algida.ro din registrul istoric',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    28094374, 'MOBILE', '0759 570 570', '+40759570570', 'COMMERCIAL',
    'OFFICIAL_WEBSITE', 'http://www.krommax.ro', 'HTML_SCRAPE_OFFICIAL_DOMAIN', 'OFFICIAL_WEBSITE',
    0.95, NULL, NULL, 'Mobil identificat pe site-ul oficial krommax.ro',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    28094374, 'LANDLINE', '0371 454 400', '+40371454400', 'OFFICE',
    'OFFICIAL_WEBSITE', 'http://www.krommax.ro', 'HTML_SCRAPE_OFFICIAL_DOMAIN', 'OFFICIAL_WEBSITE',
    0.95, NULL, NULL, 'Fix identificat pe site-ul oficial krommax.ro',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    28094374, 'EMAIL', 'contact.krommax@gmail.com', 'contact.krommax@gmail.com', 'OFFICE',
    'OFFICIAL_WEBSITE', 'http://www.krommax.ro', 'HTML_SCRAPE_OFFICIAL_DOMAIN', 'OFFICIAL_WEBSITE',
    0.95, NULL, NULL, 'Email identificat pe site-ul oficial krommax.ro',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    28094374, 'WEBSITE', 'https://www.krommax.ro', 'https://www.krommax.ro', 'OFFICE',
    'OFFICIAL_WEBSITE', 'http://www.krommax.ro', 'HTML_SCRAPE_OFFICIAL_DOMAIN', 'OFFICIAL_WEBSITE',
    0.95, NULL, NULL, 'Domeniu web oficial verificat activ (HTTP 200)',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    21457545, 'MOBILE', '0788 201 871', '+40788201871', 'COMMERCIAL',
    'OFFICIAL_WEBSITE', 'http://www.cibernetservice.ro/contact', 'HTML_SCRAPE_OFFICIAL_DOMAIN', 'OFFICIAL_WEBSITE',
    0.95, NULL, NULL, 'Mobil Digi identificat pe pagina de contact cibernetservice.ro/contact',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    21457545, 'EMAIL', 'office@cibernetservice.ro', 'office@cibernetservice.ro', 'OFFICE',
    'OFFICIAL_WEBSITE', 'http://www.cibernetservice.ro/contact', 'HTML_SCRAPE_OFFICIAL_DOMAIN', 'OFFICIAL_WEBSITE',
    0.95, NULL, NULL, 'Email oficial identificat pe cibernetservice.ro/contact',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    21457545, 'WEBSITE', 'https://www.cibernetservice.ro', 'https://www.cibernetservice.ro', 'OFFICE',
    'OFFICIAL_WEBSITE', 'http://www.cibernetservice.ro/contact', 'HTML_SCRAPE_OFFICIAL_DOMAIN', 'OFFICIAL_WEBSITE',
    0.95, NULL, NULL, 'Domeniu web oficial verificat activ (HTTP 200)',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    15433290, 'LANDLINE', '0264266111', '+40264266111', 'OFFICE',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon Cluj oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    10503468, 'LANDLINE', '0257286381', '+40257286381', 'OFFICE',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon Arad oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    5282735, 'MOBILE', '0744270546', '+40744270546', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon mobil Orange declarat în evidențele fiscale ANAF',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    12014425, 'MOBILE', '0788999371', '+40788999371', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon mobil Digi declarat în evidențele fiscale ANAF',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    15712511, 'MOBILE', '0722373854', '+40722373854', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon mobil Vodafone declarat în evidențele fiscale ANAF',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    16154936, 'MOBILE', '0723510432', '+40723510432', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon mobil Vodafone declarat în evidențele fiscale ANAF',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    16154936, 'LANDLINE', '0314251271', '+40314251271', 'OFFICE',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Linie fixă/fax declarată în evidențele fiscale ANAF',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    412052, 'LANDLINE', '016598610', '+40216598610', 'OFFICE',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat la ANAF (prefix vechi București 01 -> +4021)',
    '2026-11-15 22:31:17', '2026-11-15 22:31:17'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    16731856, 'LANDLINE', '0318044412', '+40318044412', 'OFFICE',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:04', '2026-11-15 22:32:04'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    17028260, 'MOBILE', '0745324553', '+40745324553', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:04', '2026-11-15 22:32:04'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    16873931, 'MOBILE', '0730889140', '+40730889140', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:04', '2026-11-15 22:32:04'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    20363221, 'LANDLINE', '0314085288', '+40314085288', 'OFFICE',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:55', '2026-11-15 22:32:55'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    18945830, 'LANDLINE', '0212117542', '+40212117542', 'OFFICE',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:55', '2026-11-15 22:32:55'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    21434118, 'MOBILE', '0745137745', '+40745137745', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:55', '2026-11-15 22:32:55'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    21878226, 'MOBILE', '0745158250', '+40745158250', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:55', '2026-11-15 22:32:55'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    22481410, 'MOBILE', '0727843876', '+40727843876', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:55', '2026-11-15 22:32:55'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    22637307, 'MOBILE', '0741247745', '+40741247745', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:55', '2026-11-15 22:32:55'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    24062892, 'MOBILE', '0753117102', '+40753117102', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:55', '2026-11-15 22:32:55'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    28324490, 'MOBILE', '0730999341', '+40730999341', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:55', '2026-11-15 22:32:55'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    28041639, 'MOBILE', '0726007306', '+40726007306', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:55', '2026-11-15 22:32:55'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    20766283, 'MOBILE', '0745921583', '+40745921583', 'COMMERCIAL',
    'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
    0.85, NULL, NULL, 'Telefon oficial declarat în evidențele fiscale ANAF',
    '2026-11-15 22:32:55', '2026-11-15 22:32:55'
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;
