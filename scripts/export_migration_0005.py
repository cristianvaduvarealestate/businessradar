import sqlite3

db = sqlite3.connect('data/radar_business.db')
db.row_factory = sqlite3.Row
cursor = db.cursor()

contacts = cursor.execute("SELECT * FROM contact_records").fetchall()

with open('migrations/0005_seed_discovered_contacts.sql', 'w', encoding='utf-8') as f:
    f.write("-- 0005_seed_discovered_contacts.sql: Sync enriched contacts into Cloudflare D1\n")
    f.write("-- Correct historical malformed websites\n")
    f.write("UPDATE companies SET website = NULL WHERE cui = 33898294;\n")
    f.write("UPDATE companies SET website = NULL WHERE cui = 15848999;\n")
    f.write("DELETE FROM contact_records WHERE cui = 15848999 AND contact_value LIKE '%ofice@algida.ro%';\n\n")

    f.write("-- Insert enriched contact records\n")
    for c in contacts:
        def esc(val):
            if val is None: return "NULL"
            return "'" + str(val).replace("'", "''") + "'"
        
        sql = f"""INSERT INTO contact_records (
    cui, contact_type, contact_value, normalized_value, label,
    source_name, provenance_url, verification_method, verification_status,
    confidence_score, contact_person, contact_person_position, notes,
    discovered_at, last_checked_at
) VALUES (
    {c['cui']}, {esc(c['contact_type'])}, {esc(c['contact_value'])}, {esc(c['normalized_value'])}, {esc(c['label'])},
    {esc(c['source_name'])}, {esc(c['provenance_url'])}, {esc(c['verification_method'])}, {esc(c['verification_status'])},
    {c['confidence_score'] or 0.8}, {esc(c['contact_person'])}, {esc(c['contact_person_position'])}, {esc(c['notes'])},
    {esc(c['discovered_at'])}, {esc(c['last_checked_at'])}
) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
    normalized_value = excluded.normalized_value,
    verification_status = excluded.verification_status,
    confidence_score = excluded.confidence_score,
    source_name = excluded.source_name,
    provenance_url = excluded.provenance_url,
    notes = excluded.notes,
    last_checked_at = CURRENT_TIMESTAMP;\n"""
        f.write(sql)

print(f"Generated migrations/0005_seed_discovered_contacts.sql with {len(contacts)} contacts.")
db.close()
