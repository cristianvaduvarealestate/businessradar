import sqlite3
import json
import urllib.request
import re
import time

def normalize_phone(raw):
    if not raw: return None
    clean = re.sub(r'[\s\-\.\(\)\/]', '', raw)
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

# Get top 20 active companies by opportunity score
companies = cursor.execute("""
    SELECT cui, name, county, city, opportunity_score 
    FROM companies 
    WHERE cui NOT IN (SELECT cui FROM suppression_list WHERE cui IS NOT NULL)
    ORDER BY opportunity_score DESC 
    LIMIT 20
""").fetchall()

print(f"Selected {len(companies)} top companies to query on ANAF PlatitorTvaRest v9...")

cuis = [c['cui'] for c in companies]
payload = [{'cui': c, 'data': '2026-11-15'} for c in cuis]

req = urllib.request.Request(
    'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'User-Agent': 'RadarBusinessRomania/2.0'}
)

discovered_anaf = []

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        found = data.get('found', [])
        print(f"ANAF responded! Found: {len(found)} companies.")
        for item in found:
            dg = item.get('date_generale', {})
            cui = dg.get('cui')
            den = dg.get('denumire')
            tel = dg.get('telefon')
            fax = dg.get('fax')
            stare = dg.get('stare_inregistrare')
            adresa = dg.get('adresa')
            
            p_tel = normalize_phone(tel) if tel else None
            p_fax = normalize_phone(fax) if fax else None
            
            print(f"[{cui}] {den}")
            print(f"   Stare: {stare}")
            print(f"   Adresa: {adresa}")
            if p_tel:
                print(f"   >>> TELEFON DECLARAT: {p_tel['normalized']} ({p_tel['type']})")
                discovered_anaf.append({
                    'cui': cui,
                    'type': p_tel['type'],
                    'original': tel,
                    'normalized': p_tel['normalized'],
                    'notes': 'Telefon oficial declarat în evidențele fiscale ANAF'
                })
            if p_fax and (not p_tel or p_fax['normalized'] != p_tel['normalized']):
                print(f"   >>> FAX/LINIE DECLARAT: {p_fax['normalized']} (LANDLINE)")
                discovered_anaf.append({
                    'cui': cui,
                    'type': 'LANDLINE',
                    'original': fax,
                    'normalized': p_fax['normalized'],
                    'notes': 'Linie secundară/fax declarată în evidențele fiscale ANAF'
                })
except Exception as e:
    print(f"ANAF Query Error: {e}")

print(f"\nTotal real phones discovered from ANAF batch: {len(discovered_anaf)}")
db.close()
