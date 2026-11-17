#!/usr/bin/env python3
"""
BUSINESS RADAR — PROSPECTING PORTFOLIOS IMPORTER & CRM SEEDING
Imports both portfolios:
  - Portfolio A: General Prospecting (Pasted text.txt)
  - Portfolio B: Hotels, Guesthouses, Rent-a-car & Construction (Pasted markdown (2).md)
Populates:
  - prospect_records
Reconciles with existing companies table without modifying historical records.
"""

import os
import sys
import re
import json
import sqlite3
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'radar_business.db')
SOURCE_MD = os.path.join(os.path.dirname(__file__), '..', 'data', 'sources_import', 'Pasted markdown (2).md')
SOURCE_TXT = os.path.join(os.path.dirname(__file__), '..', 'data', 'sources_import', 'Pasted text.txt')

def clean_markdown_val(v):
    return v.replace('**', '').replace('\\@', '@').replace('\\.', '.').strip()

def parse_portfolio_b(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    records = []
    for line in lines:
        line_clean = line.strip()
        if not line_clean.startswith('|'):
            continue
        cols = [c.strip() for c in line_clean.strip('|').split('|')]
        if len(cols) < 9:
            continue
        if 'Nr' in cols[0] or ':---' in cols[0]:
            continue
        
        cols = [clean_markdown_val(c) for c in cols]
        nr = cols[0]
        name = cols[1]
        domain = cols[2]
        loc_jud = cols[3]
        adresa = cols[4]
        telefon = cols[5]
        email = cols[6]
        web_obs = cols[7]
        sugestie = cols[8]
        nota = cols[9] if len(cols) > 9 else ''
        
        county = ''
        city = ''
        if loc_jud:
            parts = [p.strip() for p in loc_jud.split(',')]
            if len(parts) >= 2:
                city = parts[0]
                county = parts[1]
            else:
                city = parts[0]
        
        cui = ''
        cui_match = re.search(r'CUI\s*(?:RO)?\s*([0-9]{2,10})', web_obs + ' ' + name, re.IGNORECASE)
        if cui_match:
            cui = cui_match.group(1)
            
        phones = []
        if telefon:
            for p in re.split(r'[/,;]|\s+sau\s+', telefon):
                p_clean = p.strip()
                if p_clean:
                    phones.append(p_clean)
                    
        emails = []
        if email:
            for e in re.split(r'[/,;]|\s+', email):
                e_clean = e.strip()
                if '@' in e_clean:
                    emails.append(e_clean)

        records.append({
            'id': f"pr_niche_{str(uuid.uuid4())[:8]}",
            'portfolio_type': 'NICHE_HORECA_AUTO_CONSTRUCT',
            'source_file': 'Pasted markdown (2).md',
            'source_row_index': int(nr) if nr.isdigit() else len(records) + 1,
            'company_name': name,
            'cui': cui,
            'reg_com': '',
            'domain': domain,
            'county': county,
            'city': city,
            'address': adresa,
            'phones': json.dumps(phones, ensure_ascii=False),
            'emails': json.dumps(emails, ensure_ascii=False),
            'website': web_obs,
            'contact_persons': '',
            'initial_notes': f"Observații: {web_obs}\nNotă verificare: {nota}".strip(),
            'verification_note': nota,
            'insurance_suggestions': sugestie,
            'confirmed_interested_products': json.dumps([], ensure_ascii=False),
            'commercial_status': 'NEW_UNVERIFIED',
            'decision_maker': '',
            'operational_notes': '',
            'is_incomplete': 1 if (not phones and not emails) or not name else 0,
            'next_callback_date': None,
            'next_action': None,
            'raw_content': line_clean
        })
    return records


def parse_portfolio_a(text_path):
    with open(text_path, 'r', encoding='utf-8') as f:
        content = f.read()

    raw_lines = content.split('\n')
    records = []
    
    i = 0
    n = len(raw_lines)
    current_city = "București"
    
    while i < n:
        line = raw_lines[i]
        line_strip = line.strip()
        
        if not line_strip:
            i += 1
            continue
            
        # City header
        parts = [p.strip() for p in line.split('\t') if p.strip()]
        if len(parts) == 1 and parts[0] in ['Brașov', 'Timișoara', 'București', 'Constanța', 'Cluj-Napoca', 'Iași']:
            current_city = parts[0]
            i += 1
            continue

        # Case 1: Line with \u2028 (multiline dossier)
        if '\u2028' in line:
            sublines = [s.strip() for s in line.split('\u2028') if s.strip()]
            comp_name = sublines[0].lstrip('•').strip()
            initial_notes = []
            insurance_sug = ""
            domain = ""
            address = ""
            city = current_city
            county = "București" if current_city == "București" else current_city
            phones = []
            emails = []
            website = ""
            contact_person = ""
            
            bracket_match = re.search(r'\((.*?)\)', comp_name)
            if bracket_match:
                note_inside = bracket_match.group(1)
                initial_notes.append(note_inside)
                if any(k in note_inside.lower() for k in ['asigur', 'rca', 'casco', 'flot', 'lead', 'angajat']):
                    insurance_sug = note_inside
                comp_name = re.sub(r'\(.*?\)', '', comp_name).strip()

            for sub in sublines[1:]:
                if sub.startswith('(') and sub.endswith(')'):
                    inside = sub.strip('()')
                    initial_notes.append(inside)
                    if any(k in inside.lower() for k in ['asigur', 'rca', 'casco', 'flot', 'lead', 'angajat', 'propriet', 'caută oferte']):
                        if insurance_sug:
                            insurance_sug += " | " + inside
                        else:
                            insurance_sug = inside
                    continue
                
                if sub.lower().startswith('domeniu:'):
                    domain = sub.split(':', 1)[1].strip()
                    continue
                    
                if sub.lower().startswith('adresă:') or sub.lower().startswith('adresa:'):
                    address = sub.split(':', 1)[1].strip()
                    if 'sector' in address.lower() or 'bucurești' in address.lower():
                        city = "București"
                        county = "București"
                    continue
                    
                phone_matches = re.findall(r'(?:(?:\+40|0|\*)[0-9\s\.\-\/]{4,20})', sub)
                if any(sub.lower().startswith(p) for p in ['telefon:', 'telefon programări:', 'telefon fix:', 'mobil:', 'call center:', 'telefon showroom:']):
                    val = sub.split(':', 1)[1].strip()
                    for p in re.split(r'[/,;]|\s+sau\s+', val):
                        p_c = p.strip()
                        if p_c:
                            phones.append(p_c)
                    continue
                elif 'telefon' in sub.lower() or 'mobil' in sub.lower():
                    for p in phone_matches:
                        if p.strip() and len(re.sub(r'\D', '', p)) >= 4:
                            phones.append(p.strip())
                            
                email_matches = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', sub)
                if email_matches:
                    for e in email_matches:
                        emails.append(e)
                    continue
                    
                if sub.lower().startswith('site:') or sub.lower().startswith('website:'):
                    website = sub.split(':', 1)[1].strip()
                    continue
                    
                initial_notes.append(sub)

            records.append({
                'id': f"pr_gen_{str(uuid.uuid4())[:8]}",
                'portfolio_type': 'GENERAL',
                'source_file': 'Pasted text.txt',
                'source_row_index': i + 1,
                'company_name': comp_name,
                'cui': '',
                'reg_com': '',
                'domain': domain,
                'county': county,
                'city': city,
                'address': address,
                'phones': json.dumps(phones, ensure_ascii=False),
                'emails': json.dumps(emails, ensure_ascii=False),
                'website': website,
                'contact_persons': contact_person,
                'initial_notes': '\n'.join(initial_notes).strip(),
                'verification_note': '',
                'insurance_suggestions': insurance_sug,
                'confirmed_interested_products': json.dumps([], ensure_ascii=False),
                'commercial_status': 'NEW_UNVERIFIED',
                'decision_maker': '',
                'operational_notes': '',
                'is_incomplete': 1 if (not phones and not emails) or not comp_name else 0,
                'next_callback_date': None,
                'next_action': None,
                'raw_content': line
            })
            i += 1
            continue

        # Case 2: Topfirme multi-line fiscal block
        if 'cod fiscal:' in line_strip.lower() or line_strip.lower().startswith('fiscal:'):
            block_lines = [line_strip]
            j = i + 1
            while j < n and j < i + 7:
                next_l = raw_lines[j].strip()
                if any(k in next_l.lower() for k in ['nr. registrul', 'adresa:', 'localitate:', 'judet:', 'telefon:']):
                    block_lines.append(next_l)
                    j += 1
                else:
                    break
            
            cui = ""
            reg_com = ""
            address = ""
            loc = ""
            jud = ""
            phones = []
            for bl in block_lines:
                bl_lower = bl.lower()
                if 'fiscal' in bl_lower:
                    m = re.search(r'\d+', bl)
                    if m:
                        cui = m.group(0)
                elif 'nr. reg' in bl_lower or 'registrul' in bl_lower:
                    m = re.search(r'J\d+/\d+/\d+', bl, re.IGNORECASE)
                    if m:
                        reg_com = m.group(0)
                    else:
                        reg_com = bl.split(':', 1)[-1].strip()
                elif 'adresa:' in bl_lower:
                    address = bl.split(':', 1)[-1].strip()
                elif 'localitate:' in bl_lower:
                    loc = bl.split(':', 1)[-1].strip()
                elif 'judet:' in bl_lower:
                    jud = bl.split(':', 1)[-1].strip()
                elif 'telefon:' in bl_lower:
                    m = re.search(r'\d+', bl)
                    if m:
                        phones.append(m.group(0))

            comp_name = f"Firma CUI {cui}" if cui else "Firma Neidentificată"
            if reg_com:
                comp_name += f" ({reg_com})"

            records.append({
                'id': f"pr_gen_{str(uuid.uuid4())[:8]}",
                'portfolio_type': 'GENERAL',
                'source_file': 'Pasted text.txt',
                'source_row_index': i + 1,
                'company_name': comp_name,
                'cui': cui,
                'reg_com': reg_com,
                'domain': 'Comerț / Servicii',
                'county': jud or "București",
                'city': loc or "Sector 1",
                'address': address,
                'phones': json.dumps(phones, ensure_ascii=False),
                'emails': json.dumps([], ensure_ascii=False),
                'website': '',
                'contact_persons': '',
                'initial_notes': f"Extras Topfirme: CUI {cui}, Reg Com {reg_com}",
                'verification_note': 'Necesită identificare denumire comercială după CUI',
                'insurance_suggestions': 'Property / CASCO / Răspundere civilă',
                'confirmed_interested_products': json.dumps([], ensure_ascii=False),
                'commercial_status': 'NEW_UNVERIFIED',
                'decision_maker': '',
                'operational_notes': '',
                'is_incomplete': 1,
                'next_callback_date': None,
                'next_action': None,
                'raw_content': '\n'.join(block_lines)
            })
            i = j
            continue

        # Case 3: Table Header 'Clinica\tTip\tOras\tTelefon\tEmail\tWebsite'
        if 'Clinica\t' in line and 'Telefon\t' in line:
            i += 1
            while i < n:
                cur_l = raw_lines[i].strip()
                if not cur_l or cur_l.startswith('Cod fiscal:') or cur_l.startswith('Email:') or 'Avocat' in cur_l:
                    break
                cols = [c.strip() for c in raw_lines[i].split('\t') if c.strip()]
                if len(cols) >= 3 and any(k in cols[1].lower() for k in ['stomatologie', 'clinica', 'medical']):
                    c_name = cols[0]
                    c_domain = cols[1]
                    c_city = cols[2] if len(cols) > 2 else "București"
                    c_phone = cols[3] if len(cols) > 3 else ""
                    c_email = cols[4] if len(cols) > 4 else ""
                    c_web = cols[5] if len(cols) > 5 else ""
                    
                    records.append({
                        'id': f"pr_gen_{str(uuid.uuid4())[:8]}",
                        'portfolio_type': 'GENERAL',
                        'source_file': 'Pasted text.txt',
                        'source_row_index': i + 1,
                        'company_name': c_name,
                        'cui': '',
                        'reg_com': '',
                        'domain': c_domain,
                        'county': 'București' if 'bucuresti' in c_city.lower() else c_city,
                        'city': c_city,
                        'address': '',
                        'phones': json.dumps([c_phone] if c_phone else [], ensure_ascii=False),
                        'emails': json.dumps([c_email] if c_email and '@' in c_email else [], ensure_ascii=False),
                        'website': c_web,
                        'contact_persons': '',
                        'initial_notes': f'Clinică {c_domain} {c_city}',
                        'verification_note': 'Verificare CUI stomatologie',
                        'insurance_suggestions': 'Malpraxis / Răspundere civilă profesională, Asigurare aparatură medicală',
                        'confirmed_interested_products': json.dumps([], ensure_ascii=False),
                        'commercial_status': 'NEW_UNVERIFIED',
                        'decision_maker': '',
                        'operational_notes': '',
                        'is_incomplete': 0 if (c_phone or c_email) else 1,
                        'next_callback_date': None,
                        'next_action': None,
                        'raw_content': raw_lines[i]
                    })
                    i += 1
                else:
                    break
            continue

        # Case 4: Google Maps Clinic
        if re.match(r'^[0-9]+[️⃣\.]\s*', line_strip):
            comp_name = re.sub(r'^[0-9]+[️⃣\.]\s*', '', line_strip)
            c_domain = "Clinică Medicală"
            c_rating = ""
            c_phone = []
            c_web = ""
            
            j = i + 1
            while j < n and j < i + 5:
                next_l = raw_lines[j].strip()
                if not next_l:
                    j += 1
                    continue
                if re.match(r'^[0-9]+[️⃣\.]\s*', next_l) or '\u2028' in next_l or 'Clinica\t' in next_l:
                    break
                if '•' in next_l or 'Medical clinic' in next_l or 'Medical Center' in next_l:
                    c_rating = next_l
                elif 'telefon:' in next_l.lower():
                    val = next_l.split(':', 1)[-1].strip()
                    c_phone.append(val)
                elif 'website:' in next_l.lower():
                    c_web = next_l.split(':', 1)[-1].strip()
                else:
                    break
                j += 1

            records.append({
                'id': f"pr_gen_{str(uuid.uuid4())[:8]}",
                'portfolio_type': 'GENERAL',
                'source_file': 'Pasted text.txt',
                'source_row_index': i + 1,
                'company_name': comp_name,
                'cui': '',
                'reg_com': '',
                'domain': c_domain,
                'county': 'București',
                'city': 'București',
                'address': '',
                'phones': json.dumps(c_phone, ensure_ascii=False),
                'emails': json.dumps([], ensure_ascii=False),
                'website': c_web,
                'contact_persons': '',
                'initial_notes': f"Profil Google Maps. {c_rating}".strip(),
                'verification_note': 'Verificare CUI și date fiscale clinică',
                'insurance_suggestions': 'Malpraxis medici, Clădiri și bunuri clinică, Răspundere civilă',
                'confirmed_interested_products': json.dumps([], ensure_ascii=False),
                'commercial_status': 'NEW_UNVERIFIED',
                'decision_maker': '',
                'operational_notes': '',
                'is_incomplete': 0 if (c_phone or c_web) else 1,
                'next_callback_date': None,
                'next_action': None,
                'raw_content': '\n'.join([raw_lines[k] for k in range(i, j)])
            })
            i = j
            continue

        # Case 5: Barou Constanta Lawyers
        if i + 3 < n and any('baroul' in raw_lines[k].lower() for k in range(i, min(i + 5, n))):
            lawyer_lines = []
            j = i
            while j < n and j < i + 6:
                ll = raw_lines[j].strip()
                if not ll:
                    j += 1
                    continue
                lawyer_lines.append(ll)
                if 'experiență' in ll.lower() or 'experienta' in ll.lower():
                    j += 1
                    break
                j += 1
            
            l_name = ""
            l_phone = []
            l_email = []
            l_notes = []
            for ll in lawyer_lines:
                cols = [c.strip() for c in ll.split('\t') if c.strip()]
                for c in cols:
                    if '@' in c:
                        l_email.append(c)
                    elif re.match(r'^(?:07|\+40|7)\d{7,10}$', re.sub(r'[\s\.\-]', '', c)):
                        l_phone.append(c)
                    elif 'baroul' in c.lower() or 'experiență' in c.lower() or 'avocat' in c.lower():
                        l_notes.append(c)
                    elif not l_name and not any(k in c.lower() for k in ['avocat', 'baroul', 'ani']):
                        l_name = c

            records.append({
                'id': f"pr_gen_{str(uuid.uuid4())[:8]}",
                'portfolio_type': 'GENERAL',
                'source_file': 'Pasted text.txt',
                'source_row_index': i + 1,
                'company_name': f"Cabinet Avocat {l_name}" if l_name else "Cabinet Avocatură Constanța",
                'cui': '',
                'reg_com': '',
                'domain': 'Servicii Juridice / Avocatură',
                'county': 'Constanța',
                'city': 'Constanța',
                'address': '',
                'phones': json.dumps(l_phone, ensure_ascii=False),
                'emails': json.dumps(l_email, ensure_ascii=False),
                'website': '',
                'contact_persons': l_name,
                'initial_notes': ' | '.join(l_notes),
                'verification_note': 'Verificare Tablou Avocați Baroul Constanța',
                'insurance_suggestions': 'Răspundere civilă profesională avocați (Malpraxis avocați)',
                'confirmed_interested_products': json.dumps([], ensure_ascii=False),
                'commercial_status': 'NEW_UNVERIFIED',
                'decision_maker': l_name,
                'operational_notes': '',
                'is_incomplete': 0 if (l_phone or l_email) else 1,
                'next_callback_date': None,
                'next_action': None,
                'raw_content': '\n'.join(lawyer_lines)
            })
            i = j
            continue

        # Case 6: Standalone Dental clinics with emojis
        if any(raw_lines[min(i+1, n-1)].strip().startswith(p) for p in ['📞', '📍', '📧']):
            c_name = line_strip
            c_phones = []
            c_emails = []
            c_address = ""
            j = i + 1
            while j < n and j < i + 5:
                cur = raw_lines[j].strip()
                if not cur:
                    j += 1
                    continue
                if cur.startswith('📞'):
                    c_phones.append(cur.replace('📞', '').strip())
                elif cur.startswith('📧') or '@' in cur:
                    c_emails.append(cur.replace('📧', '').strip())
                elif cur.startswith('📍'):
                    c_address = cur.replace('📍', '').strip()
                else:
                    break
                j += 1
                
            records.append({
                'id': f"pr_gen_{str(uuid.uuid4())[:8]}",
                'portfolio_type': 'GENERAL',
                'source_file': 'Pasted text.txt',
                'source_row_index': i + 1,
                'company_name': c_name,
                'cui': '',
                'reg_com': '',
                'domain': 'Clinică Stomatologică',
                'county': 'București',
                'city': 'București',
                'address': c_address,
                'phones': json.dumps(c_phones, ensure_ascii=False),
                'emails': json.dumps(c_emails, ensure_ascii=False),
                'website': '',
                'contact_persons': '',
                'initial_notes': 'Clinică stomatologică',
                'verification_note': 'Verificare CUI stomatologie',
                'insurance_suggestions': 'Malpraxis stomatologi, Echipamente medicale, Clădiri și bunuri',
                'confirmed_interested_products': json.dumps([], ensure_ascii=False),
                'commercial_status': 'NEW_UNVERIFIED',
                'decision_maker': '',
                'operational_notes': '',
                'is_incomplete': 0 if (c_phones or c_emails) else 1,
                'next_callback_date': None,
                'next_action': None,
                'raw_content': '\n'.join([raw_lines[k] for k in range(i, j)])
            })
            i = j
            continue

        # Case 7: Tab-separated lines
        cols = [c.strip() for c in line.split('\t') if c.strip()]
        if cols:
            emails_in_line = [c for c in cols if '@' in c]
            phones_in_line = [c for c in cols if re.search(r'\b(?:\+40|07|02|03|7)\d{7,10}\b', re.sub(r'[\s\.\-]', '', c))]
            comp_candidates = [c for c in cols if c not in emails_in_line and c not in phones_in_line and len(c) > 2]
            
            comp_name = comp_candidates[0] if comp_candidates else ""
            if not comp_name:
                if emails_in_line:
                    dom = emails_in_line[0].split('@')[-1]
                    comp_name = f"Prospect ({dom})"
                elif phones_in_line:
                    comp_name = f"Prospect Tel {phones_in_line[0]}"
                else:
                    comp_name = f"Prospect Linia {i+1}"
            
            address = ""
            if len(comp_candidates) > 1:
                for c in comp_candidates[1:]:
                    if any(k in c.lower() for k in ['str', 'prelungirea', 'prelungurea', 'sos', 'bd', 'calea']):
                        address = c

            records.append({
                'id': f"pr_gen_{str(uuid.uuid4())[:8]}",
                'portfolio_type': 'GENERAL',
                'source_file': 'Pasted text.txt',
                'source_row_index': i + 1,
                'company_name': comp_name,
                'cui': '',
                'reg_com': '',
                'domain': 'Servicii / Distribuție / Comerț',
                'county': 'București' if current_city == 'București' else current_city,
                'city': current_city,
                'address': address,
                'phones': json.dumps(phones_in_line, ensure_ascii=False),
                'emails': json.dumps(emails_in_line, ensure_ascii=False),
                'website': '',
                'contact_persons': '',
                'initial_notes': 'Import linie tab-delimited',
                'verification_note': 'Verificare date societate',
                'insurance_suggestions': 'Răspundere civilă generală, Clădiri și bunuri',
                'confirmed_interested_products': json.dumps([], ensure_ascii=False),
                'commercial_status': 'NEW_UNVERIFIED',
                'decision_maker': '',
                'operational_notes': '',
                'is_incomplete': 1 if (not comp_candidates or not (phones_in_line or emails_in_line)) else 0,
                'next_callback_date': None,
                'next_action': None,
                'raw_content': line
            })
            i += 1
            continue
            
        i += 1

    return records


def reconcile_and_insert():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check baseline counts
    cursor.execute("SELECT count(*) FROM companies;")
    baseline_companies = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM prospect_pipeline;")
    baseline_pipeline = cursor.fetchone()[0]
    print(f"Baseline companies: {baseline_companies}")
    print(f"Baseline pipeline leads: {baseline_pipeline}")

    # Build existing lookup maps
    cursor.execute("SELECT cui, name FROM companies WHERE cui IS NOT NULL AND cui != '';")
    existing_cuis = {str(row[0]).strip().upper(): row[1] for row in cursor.fetchall()}
    
    cursor.execute("SELECT name, cui FROM companies WHERE name IS NOT NULL AND name != '';")
    existing_names = {str(row[0]).strip().upper(): str(row[1]) for row in cursor.fetchall()}

    # Clear previous prospect_records if re-running
    cursor.execute("DELETE FROM prospect_discussions;")
    cursor.execute("DELETE FROM prospect_records;")
    conn.commit()

    # Parse both portfolios
    records_b = parse_portfolio_b(SOURCE_MD)
    records_a = parse_portfolio_a(SOURCE_TXT)
    
    print(f"\nParsed Portfolio B (Niche): {len(records_b)} records")
    print(f"Parsed Portfolio A (General): {len(records_a)} records")
    all_records = records_b + records_a
    print(f"Total prospect records to import: {len(all_records)}")

    matched_cui_count = 0
    potential_duplicate_count = 0
    incomplete_count = 0

    insert_sql = """
    INSERT INTO prospect_records (
        id, portfolio_type, source_file, source_row_index, raw_content,
        company_name, cui, reg_com, domain, county, city, address,
        phones, emails, website, contact_persons, initial_notes,
        verification_note, insurance_suggestions, confirmed_interested_products,
        commercial_status, decision_maker, operational_notes,
        is_incomplete, matched_cui, matched_company_name, is_potential_duplicate,
        next_callback_date, next_action, created_at, updated_at
    ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, datetime('now'), datetime('now')
    );
    """

    for r in all_records:
        matched_cui = None
        matched_name = None
        is_dup = 0
        
        # Check CUI match
        cui_clean = r['cui'].strip().upper() if r['cui'] else None
        if cui_clean and cui_clean in existing_cuis:
            matched_cui = cui_clean
            matched_name = existing_cuis[cui_clean]
            matched_cui_count += 1
        else:
            # Check name match
            name_norm = re.sub(r'[^a-zA-Z0-9]', '', r['company_name'].upper())
            for ex_name, ex_cui in existing_names.items():
                ex_norm = re.sub(r'[^a-zA-Z0-9]', '', ex_name)
                if len(name_norm) > 5 and len(ex_norm) > 5 and (name_norm in ex_norm or ex_norm in name_norm):
                    is_dup = 1
                    matched_name = ex_name
                    matched_cui = ex_cui
                    potential_duplicate_count += 1
                    break

        if r['is_incomplete']:
            incomplete_count += 1

        cursor.execute(insert_sql, (
            r['id'], r['portfolio_type'], r['source_file'], r['source_row_index'], r['raw_content'],
            r['company_name'], r['cui'] or None, r['reg_com'] or None, r['domain'] or None,
            r['county'] or None, r['city'] or None, r['address'] or None,
            r['phones'], r['emails'], r['website'] or None, r['contact_persons'] or None,
            r['initial_notes'] or None, r['verification_note'] or None, r['insurance_suggestions'] or None,
            r['confirmed_interested_products'], r['commercial_status'], r['decision_maker'] or None,
            r['operational_notes'] or None, r['is_incomplete'], matched_cui, matched_name, is_dup,
            r['next_callback_date'], r['next_action']
        ))

    conn.commit()

    # Verify counts
    cursor.execute("SELECT count(*) FROM prospect_records;")
    total_imported = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM prospect_records WHERE portfolio_type = 'GENERAL';")
    total_general = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM prospect_records WHERE portfolio_type = 'NICHE_HORECA_AUTO_CONSTRUCT';")
    total_niche = cursor.fetchone()[0]

    # Verify existing untouched
    cursor.execute("SELECT count(*) FROM companies;")
    final_companies = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM prospect_pipeline;")
    final_pipeline = cursor.fetchone()[0]

    conn.close()

    print("\n--- IMPORT SUMMARY ---")
    print(f"Total prospect records imported: {total_imported}")
    print(f"  • Portfolio A (General): {total_general}")
    print(f"  • Portfolio B (Niche HORECA/Auto/Construct): {total_niche}")
    print(f"Incomplete records flagged: {incomplete_count}")
    print(f"CUI exact matches with national registry: {matched_cui_count}")
    print(f"Potential name matches flagged: {potential_duplicate_count}")
    print(f"Untouched historical companies: {final_companies} (verified baseline {baseline_companies})")
    print(f"Untouched CRM pipeline leads: {final_pipeline} (verified baseline {baseline_pipeline})")

if __name__ == '__main__':
    reconcile_and_insert()
