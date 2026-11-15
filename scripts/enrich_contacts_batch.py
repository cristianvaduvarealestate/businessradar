import sqlite3
import json
import urllib.request
import re
import time
import os

def normalize_phone(raw):
    if not raw: return None
    clean = re.sub(r'[\s\-\.\(\)\/]', '', str(raw).strip())
    if clean.startswith('0040'): clean = '+40' + clean[4:]
    elif clean.startswith('40') and len(clean) >= 11: clean = '+' + clean
    elif clean.startswith('+40'): pass
    elif clean.startswith('01') and len(clean) == 9: clean = '+4021' + clean[2:]
    elif clean.startswith('0') and len(clean) == 10: clean = '+40' + clean[1:]
    
    if not re.match(r'^\+40[237]\d{8}$', clean): return None
    ptype = 'MOBILE' if clean.startswith('+407') else ('LANDLINE' if clean.startswith('+402') or clean.startswith('+403') else 'PHONE')
    return {'normalized': clean, 'type': ptype}

db = sqlite3.connect('data/radar_business.db')
db.row_factory = sqlite3.Row
cursor = db.cursor()

# 1. First, correct the historical audit records
print("=== Step 1: Correcting historical records ===")

# Fix ANANDA GARDENS (33898294): 0744700293 is mobile
cursor.execute("""
    INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, notes, discovered_at, last_checked_at
    ) VALUES (
        33898294, 'MOBILE', '0744700293', '+40744700293', 'COMMERCIAL',
        'HISTORICAL_REGISTRY', 'data/radar_business.db', 'REGISTRY_FIELD_EXTRACTION', 'DECLARED_BY_COMPANY',
        0.85, 'Număr mobil extras din evidențele companiei (corectat din câmpul website)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score
""")
cursor.execute("UPDATE companies SET website = NULL WHERE cui = 33898294")

# Fix ALGIDA CENTER (15848999): www.ofice@algida.ro is email
cursor.execute("""
    INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, notes, discovered_at, last_checked_at
    ) VALUES (
        15848999, 'EMAIL', 'office@algida.ro', 'office@algida.ro', 'OFFICE',
        'HISTORICAL_REGISTRY', 'data/radar_business.db', 'REGISTRY_FIELD_EXTRACTION', 'DECLARED_BY_COMPANY',
        0.85, 'Adresă email corectată din formatul eronat www.ofice@algida.ro din registrul istoric', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score
""")
# Delete malformed website from contact_records
cursor.execute("DELETE FROM contact_records WHERE cui = 15848999 AND contact_value LIKE '%ofice@algida.ro%'")
cursor.execute("UPDATE companies SET website = NULL WHERE cui = 15848999")

# Fix KROMMAX SRL (28094374): website verified + extracted mobile, landline, email
krommax_contacts = [
    ('MOBILE', '0759 570 570', '+40759570570', 'COMMERCIAL', 0.95, 'Mobil identificat pe site-ul oficial krommax.ro'),
    ('LANDLINE', '0371 454 400', '+40371454400', 'OFFICE', 0.95, 'Fix identificat pe site-ul oficial krommax.ro'),
    ('EMAIL', 'contact.krommax@gmail.com', 'contact.krommax@gmail.com', 'OFFICE', 0.95, 'Email identificat pe site-ul oficial krommax.ro'),
    ('WEBSITE', 'https://www.krommax.ro', 'https://www.krommax.ro', 'OFFICE', 0.95, 'Domeniu web oficial verificat activ (HTTP 200)')
]
for ctype, cval, cnorm, clabel, cconf, cnotes in krommax_contacts:
    cursor.execute("""
        INSERT INTO contact_records (
            cui, contact_type, contact_value, normalized_value, label,
            source_name, provenance_url, verification_method, verification_status,
            confidence_score, notes, discovered_at, last_checked_at
        ) VALUES (
            28094374, ?, ?, ?, ?,
            'OFFICIAL_WEBSITE', 'http://www.krommax.ro', 'HTML_SCRAPE_OFFICIAL_DOMAIN', 'OFFICIAL_WEBSITE',
            ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
            normalized_value = excluded.normalized_value,
            verification_status = excluded.verification_status,
            confidence_score = excluded.confidence_score
    """, (ctype, cval, cnorm, clabel, cconf, cnotes))

# Fix CIBERNET SERVICE SRL (21457545): website verified + extracted mobile, email
cibernet_contacts = [
    ('MOBILE', '0788 201 871', '+40788201871', 'COMMERCIAL', 0.95, 'Mobil Digi identificat pe pagina de contact cibernetservice.ro/contact'),
    ('EMAIL', 'office@cibernetservice.ro', 'office@cibernetservice.ro', 'OFFICE', 0.95, 'Email oficial identificat pe cibernetservice.ro/contact'),
    ('WEBSITE', 'https://www.cibernetservice.ro', 'https://www.cibernetservice.ro', 'OFFICE', 0.95, 'Domeniu web oficial verificat activ (HTTP 200)')
]
for ctype, cval, cnorm, clabel, cconf, cnotes in cibernet_contacts:
    cursor.execute("""
        INSERT INTO contact_records (
            cui, contact_type, contact_value, normalized_value, label,
            source_name, provenance_url, verification_method, verification_status,
            confidence_score, notes, discovered_at, last_checked_at
        ) VALUES (
            21457545, ?, ?, ?, ?,
            'OFFICIAL_WEBSITE', 'http://www.cibernetservice.ro/contact', 'HTML_SCRAPE_OFFICIAL_DOMAIN', 'OFFICIAL_WEBSITE',
            ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
            normalized_value = excluded.normalized_value,
            verification_status = excluded.verification_status,
            confidence_score = excluded.confidence_score
    """, (ctype, cval, cnorm, clabel, cconf, cnotes))

# Fix STIM SERVICE SRL (15433290): ANAF landline + website
cursor.execute("""
    INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, notes, discovered_at, last_checked_at
    ) VALUES (
        15433290, 'LANDLINE', '0264266111', '+40264266111', 'OFFICE',
        'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
        0.85, 'Telefon Cluj oficial declarat în evidențele fiscale ANAF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score
""")

# Fix JANTO SRL (10503468): ANAF landline
cursor.execute("""
    INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, notes, discovered_at, last_checked_at
    ) VALUES (
        10503468, 'LANDLINE', '0257286381', '+40257286381', 'OFFICE',
        'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
        0.85, 'Telefon Arad oficial declarat în evidențele fiscale ANAF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score
""")

# Insert CUI 5282735 (AMC TRANS MULTICOM SRL)
cursor.execute("""
    INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, notes, discovered_at, last_checked_at
    ) VALUES (
        5282735, 'MOBILE', '0744270546', '+40744270546', 'COMMERCIAL',
        'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
        0.85, 'Telefon mobil Orange declarat în evidențele fiscale ANAF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score
""")

# Insert CUI 12014425 (S&H TRUST CONSTRUCTION SRL)
cursor.execute("""
    INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, notes, discovered_at, last_checked_at
    ) VALUES (
        12014425, 'MOBILE', '0788999371', '+40788999371', 'COMMERCIAL',
        'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
        0.85, 'Telefon mobil Digi declarat în evidențele fiscale ANAF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score
""")

# Insert CUI 15712511 (METALPLAST CONSTRUCT SRL)
cursor.execute("""
    INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, notes, discovered_at, last_checked_at
    ) VALUES (
        15712511, 'MOBILE', '0722373854', '+40722373854', 'COMMERCIAL',
        'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
        0.85, 'Telefon mobil Vodafone declarat în evidențele fiscale ANAF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score
""")

# Insert CUI 16154936 (NORTIA EDILITARE S.R.L.)
cursor.execute("""
    INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, notes, discovered_at, last_checked_at
    ) VALUES (
        16154936, 'MOBILE', '0723510432', '+40723510432', 'COMMERCIAL',
        'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
        0.85, 'Telefon mobil Vodafone declarat în evidențele fiscale ANAF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score
""")

cursor.execute("""
    INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, notes, discovered_at, last_checked_at
    ) VALUES (
        16154936, 'LANDLINE', '0314251271', '+40314251271', 'OFFICE',
        'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
        0.85, 'Linie fixă/fax declarată în evidențele fiscale ANAF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score
""")

# Insert CUI 412052 (TRANSIDEAL SRL)
cursor.execute("""
    INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, notes, discovered_at, last_checked_at
    ) VALUES (
        412052, 'LANDLINE', '016598610', '+40216598610', 'OFFICE',
        'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY',
        0.85, 'Telefon oficial declarat la ANAF (prefix vechi București 01 -> +4021)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score
""")

db.commit()
print("Historical records cleaned and initial discoveries saved to SQLite.")

# 2. Query next batch of 50 companies from DB
print("=== Step 2: Querying next batch of 50 companies on ANAF v9 ===")
next_companies = cursor.execute("""
    SELECT cui, name FROM companies 
    WHERE cui NOT IN (SELECT DISTINCT cui FROM contact_records)
      AND cui NOT IN (SELECT cui FROM suppression_list WHERE cui IS NOT NULL)
    ORDER BY opportunity_score DESC
    LIMIT 50
""").fetchall()

print(f"Querying {len(next_companies)} companies...")

cuis = [c['cui'] for c in next_companies]
chunk_size = 25
discovered_count = 0

for i in range(0, len(cuis), chunk_size):
    chunk = cuis[i:i + chunk_size]
    payload = [{'cui': c, 'data': '2026-11-15'} for c in chunk]
    req = urllib.request.Request(
        'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'User-Agent': 'RadarBusinessRomania/2.0'}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            found = data.get('found', [])
            for item in found:
                dg = item.get('date_generale', {})
                cui = dg.get('cui')
                tel = dg.get('telefon')
                fax = dg.get('fax')
                
                p_tel = normalize_phone(tel) if tel else None
                p_fax = normalize_phone(fax) if fax else None
                
                if p_tel:
                    discovered_count += 1
                    cursor.execute("""
                        INSERT INTO contact_records (
                            cui, contact_type, contact_value, normalized_value, label,
                            source_name, provenance_url, verification_method, verification_status,
                            confidence_score, notes, discovered_at, last_checked_at
                        ) VALUES (?, ?, ?, ?, ?, 'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY', 0.85, 'Telefon oficial declarat în evidențele fiscale ANAF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
                            normalized_value = excluded.normalized_value,
                            verification_status = excluded.verification_status,
                            confidence_score = excluded.confidence_score
                    """, (cui, p_tel['type'], tel.strip(), p_tel['normalized'], 'COMMERCIAL' if p_tel['type'] == 'MOBILE' else 'OFFICE'))
                    print(f"  [+] CUI {cui}: {p_tel['normalized']} ({p_tel['type']})")

                if p_fax and (not p_tel or p_fax['normalized'] != p_tel['normalized']):
                    discovered_count += 1
                    cursor.execute("""
                        INSERT INTO contact_records (
                            cui, contact_type, contact_value, normalized_value, label,
                            source_name, provenance_url, verification_method, verification_status,
                            confidence_score, notes, discovered_at, last_checked_at
                        ) VALUES (?, 'LANDLINE', ?, ?, 'OFFICE', 'ANAF_OPEN_DATA', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'REGISTRY_QUERY_MATCH', 'DECLARED_BY_COMPANY', 0.80, 'Linie secundară/fax declarată în evidențele fiscale ANAF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
                            normalized_value = excluded.normalized_value,
                            verification_status = excluded.verification_status,
                            confidence_score = excluded.confidence_score
                    """, (cui, fax.strip(), p_fax['normalized']))
                    print(f"  [+] CUI {cui} (Fax/Fix): {p_fax['normalized']}")

                cursor.execute("UPDATE companies SET last_verified_at = CURRENT_TIMESTAMP WHERE cui = ?", (cui,))
            db.commit()
    except Exception as e:
        print(f"  [-] Chunk error: {e}")
    time.sleep(1)

db.commit()

# Current counts
total_contacts = cursor.execute("SELECT count(*) FROM contact_records").fetchone()[0]
mobiles = cursor.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'MOBILE'").fetchone()[0]
landlines = cursor.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'LANDLINE'").fetchone()[0]
emails = cursor.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'EMAIL'").fetchone()[0]
websites = cursor.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'WEBSITE'").fetchone()[0]
unique_companies = cursor.execute("SELECT count(DISTINCT cui) FROM contact_records").fetchone()[0]

print("\n==================================================")
print("            POST-ENRICHMENT AUDIT SUMMARY         ")
print("==================================================")
print(f"Total Contact Records: {total_contacts}")
print(f"  - Mobile Numbers: {mobiles}")
print(f"  - Landline Numbers: {landlines}")
print(f"  - Email Addresses: {emails}")
print(f"  - Verified Websites: {websites}")
print(f"Distinct Companies with Discovered Contacts: {unique_companies}")
print("==================================================")

db.close()
