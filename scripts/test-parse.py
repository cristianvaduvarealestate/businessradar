import re
import json

def parse_portfolio_b(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    records = []
    # Find table rows
    header_found = False
    for line in lines:
        line_clean = line.strip()
        if not line_clean.startswith('|'):
            continue
        cols = [c.strip() for c in line_clean.strip('|').split('|')]
        if len(cols) < 9:
            continue
        if 'Nr' in cols[0] or ':---' in cols[0]:
            header_found = True
            continue
        
        # Clean markdown bold/backslashes
        def clean_val(v):
            v = v.replace('**', '').replace('\\@', '@').replace('\\.', '.').strip()
            return v
        
        cols = [clean_val(c) for c in cols]
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
        
        # Parse county and city
        county = ''
        city = ''
        if loc_jud:
            parts = [p.strip() for p in loc_jud.split(',')]
            if len(parts) >= 2:
                city = parts[0]
                county = parts[1]
            else:
                city = parts[0]
        
        # Extract CUI from web_obs or name if present
        cui = ''
        cui_match = re.search(r'CUI\s*(?:RO)?\s*([0-9]{2,10})', web_obs + ' ' + name, re.IGNORECASE)
        if cui_match:
            cui = cui_match.group(1)
            
        # Parse phones
        phones = []
        if telefon:
            for p in re.split(r'[/,;]|\s+sau\s+', telefon):
                p_clean = p.strip()
                if p_clean:
                    phones.append(p_clean)
                    
        # Parse emails
        emails = []
        if email:
            for e in re.split(r'[/,;]|\s+', email):
                e_clean = e.strip()
                if '@' in e_clean:
                    emails.append(e_clean)

        records.append({
            'source_row_index': int(nr) if nr.isdigit() else len(records) + 1,
            'company_name': name,
            'cui': cui,
            'domain': domain,
            'county': county,
            'city': city,
            'address': adresa,
            'phones': phones,
            'emails': emails,
            'website': web_obs,
            'initial_notes': f"Observații: {web_obs}\nNotă verificare: {nota}".strip(),
            'verification_note': nota,
            'insurance_suggestions': sugestie,
            'is_incomplete': 1 if (not phones and not emails) or not name else 0,
            'raw_content': line_clean
        })
    return records

records_b = parse_portfolio_b('data/sources_import/Pasted markdown (2).md')
print(f"Portfolio B total records parsed: {len(records_b)}")
for r in records_b[:3]:
    print(r)
import re
import json

def parse_portfolio_a(text_path):
    with open(text_path, 'r', encoding='utf-8') as f:
        content = f.read()

    raw_lines = content.split('\n')
    records = []
    
    i = 0
    n = len(raw_lines)
    
    # State tracking
    current_city = "București" # default context if mentioned (e.g. Brașov, Timișoara sections)
    
    while i < n:
        line = raw_lines[i]
        line_strip = line.strip()
        
        if not line_strip:
            i += 1
            continue
            
        # Check if line is a city header like 'Brașov' or 'Timișoara'
        parts = [p.strip() for p in line.split('\t') if p.strip()]
        if len(parts) == 1 and parts[0] in ['Brașov', 'Timișoara', 'București', 'Constanța', 'Cluj-Napoca', 'Iași']:
            current_city = parts[0]
            i += 1
            continue

        # Case 1: Line has \u2028 (multiline company dossier)
        if '\u2028' in line:
            sublines = [s.strip() for s in line.split('\u2028') if s.strip()]
            
            # First line is usually company name (sometimes with bullet like '•  Valcri Medical' or 'DAB Auto Serv (...)')
            comp_name = sublines[0].lstrip('•').strip()
            # Extract bracketed notes from name if present
            initial_notes = []
            insurance_sug = ""
            domain = ""
            address = ""
            city = current_city
            county = "București" if current_city == "București" else ""
            phones = []
            emails = []
            website = ""
            contact_person = ""
            
            # Check for notes in brackets in comp_name
            bracket_match = re.search(r'\((.*?)\)', comp_name)
            if bracket_match:
                note_inside = bracket_match.group(1)
                initial_notes.append(note_inside)
                if any(k in note_inside.lower() for k in ['asigur', 'rca', 'casco', 'flot', 'lead', 'angajat']):
                    insurance_sug = note_inside
                comp_name = re.sub(r'\(.*?\)', '', comp_name).strip()

            for sub in sublines[1:]:
                # Check bracketed notes/insurance
                if sub.startswith('(') and sub.endswith(')'):
                    inside = sub.strip('()')
                    initial_notes.append(inside)
                    if any(k in inside.lower() for k in ['asigur', 'rca', 'casco', 'flot', 'lead', 'angajat', 'propriet', 'caută oferte']):
                        if insurance_sug:
                            insurance_sug += " | " + inside
                        else:
                            insurance_sug = inside
                    continue
                
                # Check domain
                if sub.lower().startswith('domeniu:'):
                    domain = sub.split(':', 1)[1].strip()
                    continue
                    
                # Check address
                if sub.lower().startswith('adresă:') or sub.lower().startswith('adresa:'):
                    address = sub.split(':', 1)[1].strip()
                    if 'sector' in address.lower() or 'bucurești' in address.lower():
                        city = "București"
                        county = "București"
                    continue
                    
                # Check phones
                phone_matches = re.findall(r'(?:(?:\+40|0|\*)[0-9\s\.\-\/]{4,20})', sub)
                # But check if line has label
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
                            
                # Check email
                email_matches = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', sub)
                if email_matches:
                    for e in email_matches:
                        emails.append(e)
                    continue
                    
                # Check site/website
                if sub.lower().startswith('site:') or sub.lower().startswith('website:'):
                    website = sub.split(':', 1)[1].strip()
                    continue
                    
                # Other descriptive text (e.g. 'Ex. Toyota București Vest...')
                initial_notes.append(sub)

            records.append({
                'source_row_index': i + 1,
                'company_name': comp_name,
                'cui': '',
                'reg_com': '',
                'domain': domain,
                'county': county,
                'city': city,
                'address': address,
                'phones': phones,
                'emails': emails,
                'website': website,
                'contact_persons': contact_person,
                'initial_notes': '\n'.join(initial_notes).strip(),
                'verification_note': '',
                'insurance_suggestions': insurance_sug,
                'is_incomplete': 1 if (not phones and not emails) or not comp_name else 0,
                'raw_content': line
            })
            i += 1
            continue

        # Case 2: Topfirme multi-line fiscal block starting with 'Cod fiscal:' or 'fiscal:'
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
            
            # Parse the block
            cui = ""
            reg_com = ""
            address = ""
            loc = ""
            jud = ""
            phones = []
            for bl in block_lines:
                bl_clean = re.sub(r'\s+', ' ', bl)
                parts = [p.strip() for p in bl.split('\t') if p.strip()]
                line_text = parts[0] if parts else bl_clean
                
                if 'fiscal:' in line_text.lower():
                    # extract number
                    m = re.search(r'\d+', line_text)
                    if m:
                        cui = m.group(0)
                elif 'nr. registrul' in line_text.lower():
                    m = re.search(r'J\d+/\d+/\d+', line_text, re.IGNORECASE)
                    if m:
                        reg_com = m.group(0)
                    else:
                        reg_com = line_text.split(':', 1)[-1].strip()
                elif 'adresa:' in line_text.lower():
                    address = line_text.split(':', 1)[-1].strip()
                elif 'localitate:' in line_text.lower():
                    loc = line_text.split(':', 1)[-1].strip()
                elif 'judet:' in line_text.lower():
                    jud = line_text.split(':', 1)[-1].strip()
                elif 'telefon:' in line_text.lower():
                    m = re.search(r'\d+', line_text)
                    if m:
                        phones.append(m.group(0))

            comp_name = f"Firma CUI {cui}" if cui else "Firma Neidentificata"
            if reg_com:
                comp_name += f" ({reg_com})"

            records.append({
                'source_row_index': i + 1,
                'company_name': comp_name,
                'cui': cui,
                'reg_com': reg_com,
                'domain': 'Comert / Servicii',
                'county': jud or "Bucuresti",
                'city': loc or "Sector 1",
                'address': address,
                'phones': phones,
                'emails': [],
                'website': '',
                'contact_persons': '',
                'initial_notes': f"Extras Topfirme: CUI {cui}, Reg Com {reg_com}",
                'verification_note': 'Necesită identificare denumire comercială după CUI',
                'insurance_suggestions': 'Property / CASCO / Raspundere civila',
                'is_incomplete': 1, # flag as incomplete since name needs identification
                'raw_content': '\n'.join(block_lines)
            })
            i = j
            continue

        # Case 3: Table Header 'Clinica\tTip\tOras\tTelefon\tEmail\tWebsite'
        if 'Clinica\t' in line and 'Telefon\t' in line:
            i += 1
            # Next lines are table rows
            while i < n:
                cur_l = raw_lines[i].strip()
                if not cur_l or cur_l.startswith('Cod fiscal:') or cur_l.startswith('Email:') or 'Avocat' in cur_l:
                    break
                cols = [c.strip() for c in raw_lines[i].split('\t') if c.strip()]
                if len(cols) >= 3 and any(k in cols[1].lower() for k in ['stomatologie', 'clinica', 'medical']):
                    c_name = cols[0]
                    c_domain = cols[1]
                    c_city = cols[2] if len(cols) > 2 else "Bucuresti"
                    c_phone = cols[3] if len(cols) > 3 else ""
                    c_email = cols[4] if len(cols) > 4 else ""
                    c_web = cols[5] if len(cols) > 5 else ""
                    
                    records.append({
                        'source_row_index': i + 1,
                        'company_name': c_name,
                        'cui': '',
                        'reg_com': '',
                        'domain': c_domain,
                        'county': 'Bucuresti' if 'bucuresti' in c_city.lower() else c_city,
                        'city': c_city,
                        'address': '',
                        'phones': [c_phone] if c_phone else [],
                        'emails': [c_email] if c_email and '@' in c_email else [],
                        'website': c_web,
                        'contact_persons': '',
                        'initial_notes': f'Clinica {c_domain} {c_city}',
                        'verification_note': 'Verificare CUI stomatologie',
                        'insurance_suggestions': 'Malpraxis / Raspundere civila profesionala, Asigurare aparatura medicala',
                        'is_incomplete': 0 if (c_phone or c_email) else 1,
                        'raw_content': raw_lines[i]
                    })
                    i += 1
                else:
                    break
            continue

        # Case 4: Google Maps Clinic (numbered with emoji like '1️⃣ iLife Medical...', rating, phone, web)
        if re.match(r'^[0-9]+[️⃣\.]\s*', line_strip):
            comp_name = re.sub(r'^[0-9]+[️⃣\.]\s*', '', line_strip)
            c_domain = "Clinică Medicală"
            c_rating = ""
            c_phone = []
            c_web = ""
            c_notes = []
            
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
                    c_notes.append(next_l)
                elif 'telefon:' in next_l.lower():
                    val = next_l.split(':', 1)[-1].strip()
                    c_phone.append(val)
                elif 'website:' in next_l.lower():
                    c_web = next_l.split(':', 1)[-1].strip()
                else:
                    break
                j += 1

            records.append({
                'source_row_index': i + 1,
                'company_name': comp_name,
                'cui': '',
                'reg_com': '',
                'domain': c_domain,
                'county': 'Bucuresti',
                'city': 'Bucuresti',
                'address': '',
                'phones': c_phone,
                'emails': [],
                'website': c_web,
                'contact_persons': '',
                'initial_notes': f"Profil Google Maps. {c_rating}".strip(),
                'verification_note': 'Verifica CUI si date fiscale clinica',
                'insurance_suggestions': 'Malpraxis medici, Cladiri si bunuri clinica, Raspundere civila',
                'is_incomplete': 0 if (c_phone or c_web) else 1,
                'raw_content': '\n'.join([raw_lines[k] for k in range(i, j)])
            })
            i = j
            continue

        # Case 5: Barou Constanta Lawyers (Name, Phone, Email, Baroul Constanta, Experienta)
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
            
            # Parse lawyer block
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
                'source_row_index': i + 1,
                'company_name': f"Cabinet Avocat {l_name}" if l_name else "Cabinet Avocatură Constanța",
                'cui': '',
                'reg_com': '',
                'domain': 'Servicii Juridice / Avocatură',
                'county': 'Constanța',
                'city': 'Constanța',
                'address': '',
                'phones': l_phone,
                'emails': l_email,
                'website': '',
                'contact_persons': l_name,
                'initial_notes': ' | '.join(l_notes),
                'verification_note': 'Verificare Tablou Avocați Baroul Constanța',
                'insurance_suggestions': 'Răspundere civilă profesională avocați (Malpraxis avocați)',
                'is_incomplete': 0 if (l_phone or l_email) else 1,
                'raw_content': '\n'.join(lawyer_lines)
            })
            i = j
            continue

        # Case 6: Standalone Dental clinics with emojis (📞 0770..., cabinet@..., Sorident Dental Clinic)
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
                'source_row_index': i + 1,
                'company_name': c_name,
                'cui': '',
                'reg_com': '',
                'domain': 'Clinică Stomatologică',
                'county': 'București',
                'city': 'București',
                'address': c_address,
                'phones': c_phones,
                'emails': c_emails,
                'website': '',
                'contact_persons': '',
                'initial_notes': 'Clinică stomatologică',
                'verification_note': 'Verificare CUI stomatologie',
                'insurance_suggestions': 'Malpraxis stomatologi, Echipamente medicale, Clădiri și bunuri',
                'is_incomplete': 0 if (c_phones or c_emails) else 1,
                'raw_content': '\n'.join([raw_lines[k] for k in range(i, j)])
            })
            i = j
            continue

        # Case 7: Lines with tabs containing emails and/or company names
        cols = [c.strip() for c in line.split('\t') if c.strip()]
        if cols:
            emails_in_line = [c for c in cols if '@' in c]
            phones_in_line = [c for c in cols if re.search(r'\b(?:\+40|07|02|03|7)\d{7,10}\b', re.sub(r'[\s\.\-]', '', c))]
            comp_candidates = [c for c in cols if c not in emails_in_line and c not in phones_in_line and len(c) > 2]
            
            comp_name = comp_candidates[0] if comp_candidates else ""
            if not comp_name:
                if emails_in_line:
                    # Derivate name from email domain
                    dom = emails_in_line[0].split('@')[-1]
                    comp_name = f"Prospect ({dom})"
                elif phones_in_line:
                    comp_name = f"Prospect Tel {phones_in_line[0]}"
                else:
                    comp_name = f"Prospect Linia {i+1}"
            
            address = ""
            if len(comp_candidates) > 1:
                # One candidate might be address (e.g. 'prelungurea ghencea 311')
                for c in comp_candidates[1:]:
                    if any(k in c.lower() for k in ['str', 'prelungirea', 'prelungurea', 'sos', 'bd', 'calea']):
                        address = c

            records.append({
                'source_row_index': i + 1,
                'company_name': comp_name,
                'cui': '',
                'reg_com': '',
                'domain': 'Servicii / Distribuție / Comerț',
                'county': 'București' if current_city == 'București' else current_city,
                'city': current_city,
                'address': address,
                'phones': phones_in_line,
                'emails': emails_in_line,
                'website': '',
                'contact_persons': '',
                'initial_notes': 'Import linie tab-delimited',
                'verification_note': 'Verificare date societate',
                'insurance_suggestions': 'Răspundere civilă generală, Clădiri și bunuri',
                'is_incomplete': 1 if (not comp_candidates or not (phones_in_line or emails_in_line)) else 0,
                'raw_content': line
            })
            i += 1
            continue
            
        i += 1

    return records

recs_a = parse_portfolio_a('data/sources_import/Pasted text.txt')
print(f"Portfolio A total records parsed: {len(recs_a)}")
incomplete_count = sum(1 for r in recs_a if r['is_incomplete'])
print(f"Incomplete records: {incomplete_count}")
print(f"Records with emails: {sum(1 for r in recs_a if r['emails'])}")
print(f"Records with phones: {sum(1 for r in recs_a if r['phones'])}")
for r in recs_a[:5]:
    print(r['company_name'], '|', r['phones'], '|', r['emails'], '|', r['domain'])
