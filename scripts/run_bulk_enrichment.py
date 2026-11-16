#!/usr/bin/env python3
"""
BUSINESS RADAR — Full Database Contact Enrichment & Discovery Engine
Processes Romanian companies in controlled batches against:
1. ANAF v9 REST API (declared telephone, fax, address, VAT status)
2. Official website scraper & multi-signal candidate domain discovery
Syncs discoveries to both local SQLite and Cloudflare D1 with full provenance.
"""

import sys
import os
import sqlite3
import json
import urllib.request
import urllib.error
import socket
import re
import time
import argparse
import functools
from datetime import datetime

# Always flush stdout immediately for real-time progress logging
print = functools.partial(print, flush=True)

DB_PATH = 'data/radar_business.db'
ANAF_API_URL = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva'
USER_AGENT = 'RadarBusinessRomania/2.0'

def normalize_phone(raw):
    if not raw:
        return None
    clean = re.sub(r'[\s\-\.\(\)\/]', '', str(raw).strip())
    if clean.startswith('0040'):
        clean = '+40' + clean[4:]
    elif clean.startswith('40') and len(clean) >= 11:
        clean = '+' + clean
    elif clean.startswith('+40'):
        pass
    elif clean.startswith('01') and len(clean) == 9: # Bucharest legacy 01
        clean = '+4021' + clean[2:]
    elif clean.startswith('0') and len(clean) == 10:
        clean = '+40' + clean[1:]
    
    if not re.match(r'^\+40[237]\d{8}$', clean):
        return None
    
    ptype = 'MOBILE' if clean.startswith('+407') else ('LANDLINE' if clean.startswith('+402') or clean.startswith('+403') else 'PHONE')
    return {'normalized': clean, 'type': ptype, 'original': str(raw).strip()}

def candidate_domains(company_name):
    """Generate candidate .ro domain variants from legal name."""
    if not company_name:
        return []
    cleaned = re.sub(r'\b(SRL|S\.R\.L\.|SA|S\.A\.|PFA|PERSOANĂ FIZICĂ AUTORIZATĂ|ÎNTREPRINDERE INDIVIDUALĂ|II|I\.I\.|AF|SCS|SNC)\b', '', company_name, flags=re.IGNORECASE)
    # Remove diacritics
    cleaned = cleaned.replace('ă', 'a').replace('â', 'a').replace('î', 'i').replace('ș', 's').replace('ş', 's').replace('ț', 't').replace('ţ', 't')
    cleaned = cleaned.replace('Ă', 'A').replace('Â', 'A').replace('Î', 'I').replace('Ș', 'S').replace('Ş', 'S').replace('Ț', 'T').replace('Ţ', 'T')
    cleaned = re.sub(r'[\"\',.\(\)\/\-\+]', ' ', cleaned).strip()
    words = [w.lower() for w in cleaned.split() if len(w) > 1 and w.lower() not in ('de', 'si', 'la', 'cu', 'in', 'impex', 'com', 'prod', 'serv', 'construct', 'trans')]
    candidates = []
    if words:
        candidates.append(''.join(words) + '.ro')
        if len(words) > 1:
            candidates.append('-'.join(words) + '.ro')
        if len(words[0]) >= 4:
            candidates.append(words[0] + '.ro')
    return list(dict.fromkeys(candidates))

def check_port_open(host, port, timeout=0.8):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((host, port))
        s.close()
        return True
    except Exception:
        return False

def inspect_candidate_domain(domain, cui, reg_com, county, company_name):
    """
    Lawfully checks candidate domain with multi-signal identity matching.
    Returns: (status, confidence, website_url, discovered_contacts, error)
    """
    # Fast DNS pre-check to prevent hanging on dead or slow domains
    try:
        ip = socket.gethostbyname(domain)
    except Exception:
        return None

    # Fast TCP port check to reject unresponsive hosts in < 0.8s
    port = 443 if check_port_open(ip, 443, 0.8) else (80 if check_port_open(ip, 80, 0.8) else None)
    if not port:
        return None

    proto = 'https' if port == 443 else 'http'
    urls_to_try = [f'{proto}://{domain}']
    for url in urls_to_try:
        try:
            req = urllib.request.Request(
                url,
                headers={'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml'}
            )
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                if resp.status != 200:
                    continue
                content_type = resp.headers.get('Content-Type', '')
                if 'text/html' not in content_type:
                    continue
                html = resp.read(150000).decode('utf-8', errors='ignore')
                
                # Check for park page / domain for sale
                if re.search(r'(domain for sale|buy this domain|domeniu de vanzare|parcat|sedo|godaddy)', html, re.I):
                    return None
                
                # Multi-signal verification
                cui_str = str(cui)
                reg_com_str = reg_com.replace(' ', '') if reg_com else ''
                cui_match = bool(re.search(r'(?:cui|cif|cod fiscal|ro)\s*[:.]?\s*' + cui_str + r'\b', html, re.I))
                reg_com_match = bool(reg_com_str and re.search(re.escape(reg_com_str), html.replace(' ', ''), re.I))
                
                county_match = bool(county and re.search(r'\b' + re.escape(county) + r'\b', html, re.I))
                
                # Extract contacts on homepage
                discovered = []
                # Phones
                phone_matches = re.findall(r'(?:(?:\+40|0040|0)[237]\d[\s\-\.]?\d{3}[\s\-\.]?\d{3,4})', html)
                seen_phones = set()
                for pm in phone_matches:
                    pnorm = normalize_phone(pm)
                    if pnorm and pnorm['normalized'] not in seen_phones:
                        seen_phones.add(pnorm['normalized'])
                        discovered.append({
                            'type': pnorm['type'],
                            'value': pnorm['original'],
                            'normalized': pnorm['normalized'],
                            'source': 'OFFICIAL_WEBSITE',
                            'provenance': url,
                            'status': 'OFFICIAL_WEBSITE' if (cui_match or reg_com_match) else 'CANDIDATE_UNVERIFIED',
                            'confidence': 0.90 if (cui_match or reg_com_match) else 0.50,
                            'notes': f'Telefon extras de pe pagina oficială {url}'
                        })
                
                # Emails (literal matches only, never guessed)
                email_matches = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', html)
                seen_emails = set()
                for em in email_matches:
                    em_lower = em.lower()
                    if em_lower not in seen_emails and not em_lower.endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp')):
                        seen_emails.add(em_lower)
                        discovered.append({
                            'type': 'EMAIL',
                            'value': em,
                            'normalized': em_lower,
                            'source': 'OFFICIAL_WEBSITE',
                            'provenance': url,
                            'status': 'OFFICIAL_WEBSITE' if (cui_match or reg_com_match) else 'CANDIDATE_UNVERIFIED',
                            'confidence': 0.90 if (cui_match or reg_com_match) else 0.50,
                            'notes': f'Email public extras de pe {url}'
                        })

                if cui_match or reg_com_match:
                    return ('OFFICIAL_WEBSITE', 0.95, url, discovered, None)
                elif county_match and len(domain) > 7:
                    # Moderate confidence candidate
                    return ('CANDIDATE_REVIEW', 0.70, url, discovered, None)
                else:
                    # Weak name-only match -> format valid only, store candidate pending review
                    return ('FORMAT_VALID_ONLY', 0.45, url, [], None)
        except Exception as e:
            continue
    return None

def main():
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass
    parser = argparse.ArgumentParser(description="BUSINESS RADAR Bulk Enrichment Engine")
    parser.add_argument('--batch-size', type=int, default=25, help="Batch size per ANAF request (default: 25)")
    parser.add_argument('--max-batches', type=int, default=0, help="Max batches to process (0 = all remaining)")
    parser.add_argument('--sample-only', action='store_true', help="Run only the initial 25-company sample")
    parser.add_argument('--resume', action='store_true', help="Resume from last checkpoint")
    parser.add_argument('--discover-candidates', action='store_true', help="Also attempt candidate domain guessing on companies without websites")
    parser.add_argument('--sync-d1', action='store_true', help="Sync SQL results directly to Cloudflare D1")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # 1. Check existing state
    c.execute("SELECT * FROM enrichment_job_state WHERE id = 'BULK_ENRICHMENT_JOB'")
    job_state = c.fetchone()
    
    total_companies = c.execute("SELECT count(*) FROM companies").fetchone()[0]
    checked_count = c.execute("SELECT count(*) FROM companies WHERE contact_checked_at IS NOT NULL").fetchone()[0]
    remaining_count = total_companies - checked_count

    print("=================================================================")
    print("      BUSINESS RADAR — BULK CONTACT ENRICHMENT ENGINE            ")
    print("=================================================================")
    print(f"Total Database Companies: {total_companies}")
    print(f"Already Checked:          {checked_count}")
    print(f"Remaining to Process:     {remaining_count}")
    print(f"Batch Size:               {args.batch_size}")
    print(f"Mode:                     {'SAMPLE 25' if args.sample_only else ('ALL REMAINING' if args.max_batches == 0 else f'{args.max_batches} BATCHES')}")
    print("=================================================================\n")

    # Update job state to RUNNING
    c.execute("""
        UPDATE enrichment_job_state 
        SET status = 'RUNNING', total_companies = ?, companies_checked = ?, companies_remaining = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 'BULK_ENRICHMENT_JOB'
    """, (total_companies, checked_count, remaining_count))
    conn.commit()

    batches_run = 0
    total_discovered_mobiles = 0
    total_discovered_landlines = 0
    total_discovered_emails = 0
    total_discovered_websites = 0
    total_without_contacts = 0
    failed_requests_count = 0
    rate_limited_count = 0

    while True:
        if args.sample_only and batches_run >= 1:
            print("\n[INFO] Sample batch completed as requested.")
            break
        if args.max_batches > 0 and batches_run >= args.max_batches:
            print(f"\n[INFO] Reached requested limit of {args.max_batches} batches.")
            break

        # Select next batch of unchecked companies
        c.execute("""
            SELECT cui, name, county, city, reg_com, website, opportunity_score
            FROM companies
            WHERE contact_checked_at IS NULL
              AND cui NOT IN (SELECT cui FROM suppression_list WHERE cui IS NOT NULL)
            ORDER BY opportunity_score DESC, cui ASC
            LIMIT ?
        """, (args.batch_size,))
        batch = c.fetchall()

        if not batch:
            print("[INFO] No more eligible unchecked companies remaining. All processed!")
            break

        batches_run += 1
        print(f"\n--- Batch {batches_run} ({len(batch)} companies) ---")
        cuis = [row['cui'] for row in batch]
        company_map = {row['cui']: row for row in batch}

        # 1. Query ANAF v9 REST API in a single HTTP POST
        payload = [{'cui': cui, 'data': '2026-11-15'} for cui in cuis]
        anaf_results = {}
        anaf_error = False

        def call_anaf(sub_cuis):
            res_dict = {}
            p = [{'cui': c, 'data': '2026-11-15'} for c in sub_cuis]
            r = urllib.request.Request(
                ANAF_API_URL,
                data=json.dumps(p).encode('utf-8'),
                headers={'Content-Type': 'application/json', 'User-Agent': USER_AGENT}
            )
            with urllib.request.urlopen(r, timeout=25) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                for item in data.get('found', []):
                    dg = item.get('date_generale', {})
                    c_cui = dg.get('cui')
                    if c_cui:
                        res_dict[c_cui] = {
                            'telefon': dg.get('telefon'),
                            'fax': dg.get('fax'),
                            'adresa': dg.get('adresa'),
                            'scpTVA': item.get('inregistrare_scop_Tva', {}).get('scpTVA', False),
                            'statusInactivi': item.get('stare_inactiv', {}).get('statusInactivi', False)
                        }
            return res_dict

        try:
            anaf_results = call_anaf(cuis)
        except Exception as e:
            print(f"  [!] Initial chunk of {len(cuis)} failed ({e}). Retrying in 2 smaller sub-chunks...")
            time.sleep(1.5)
            try:
                sub1 = cuis[:len(cuis)//2]
                sub2 = cuis[len(cuis)//2:]
                r1 = call_anaf(sub1)
                time.sleep(1)
                r2 = call_anaf(sub2)
                anaf_results = {**r1, **r2}
            except Exception as e2:
                print(f"  [-] ANAF Provider Failure: {e2}")
                anaf_error = True
                failed_requests_count += 1

        d1_sql_statements = []

        # 2. Process each company in batch
        for row in batch:
            cui = row['cui']
            name = row['name']
            reg_com = row['reg_com'] or ''
            county = row['county'] or ''
            existing_web = (row['website'] or '').strip()

            if anaf_error and not existing_web:
                # Accurately record provider failure
                c.execute("""
                    UPDATE companies 
                    SET contact_checked_at = CURRENT_TIMESTAMP,
                        contact_check_status = 'PROVIDER_ERROR',
                        contact_check_sources = 'ANAF_V9'
                    WHERE cui = ?
                """, (cui,))
                d1_sql_statements.append(f"""
                    UPDATE companies 
                    SET contact_checked_at = CURRENT_TIMESTAMP,
                        contact_check_status = 'PROVIDER_ERROR',
                        contact_check_sources = 'ANAF_V9'
                    WHERE cui = {cui};
                """)
                continue

            discovered_for_company = []
            checked_sources = ['ANAF_V9']

            # A. Check ANAF result
            if cui in anaf_results:
                a_res = anaf_results[cui]
                tel = a_res.get('telefon')
                fax = a_res.get('fax')

                p_tel = normalize_phone(tel) if tel else None
                p_fax = normalize_phone(fax) if fax else None

                if p_tel:
                    discovered_for_company.append({
                        'type': p_tel['type'],
                        'value': tel.strip(),
                        'normalized': p_tel['normalized'],
                        'label': 'COMMERCIAL' if p_tel['type'] == 'MOBILE' else 'OFFICE',
                        'source': 'ANAF_OPEN_DATA',
                        'provenance': ANAF_API_URL,
                        'method': 'REGISTRY_QUERY_MATCH',
                        'status': 'DECLARED_BY_COMPANY',
                        'confidence': 0.85,
                        'notes': f"Număr de contact declarat în evidențele fiscale ANAF ({p_tel['type']})"
                    })
                    if p_tel['type'] == 'MOBILE':
                        total_discovered_mobiles += 1
                    else:
                        total_discovered_landlines += 1

                if p_fax and (not p_tel or p_fax['normalized'] != p_tel['normalized']):
                    discovered_for_company.append({
                        'type': 'LANDLINE',
                        'value': fax.strip(),
                        'normalized': p_fax['normalized'],
                        'label': 'OFFICE',
                        'source': 'ANAF_OPEN_DATA',
                        'provenance': ANAF_API_URL,
                        'method': 'REGISTRY_QUERY_MATCH',
                        'status': 'DECLARED_BY_COMPANY',
                        'confidence': 0.80,
                        'notes': 'Linie secundară/fax declarată în evidențele fiscale ANAF'
                    })
                    total_discovered_landlines += 1

            # B. Website Discovery / Scrape
            checked_sources.append('WEBSITE_DISCOVERY')
            website_found = None
            if existing_web:
                # Company already had candidate website
                web_insp = inspect_candidate_domain(existing_web.replace('https://', '').replace('http://', '').strip('/'), cui, reg_com, county, name)
                if web_insp:
                    w_status, w_conf, w_url, w_contacts, _ = web_insp
                    website_found = w_url
                    discovered_for_company.append({
                        'type': 'WEBSITE',
                        'value': existing_web,
                        'normalized': w_url,
                        'label': 'OFFICE',
                        'source': 'OFFICIAL_WEBSITE',
                        'provenance': w_url,
                        'method': 'HTTP_VERIFICATION',
                        'status': w_status,
                        'confidence': w_conf,
                        'notes': f'Site oficial verificat prin protocol HTTP'
                    })
                    total_discovered_websites += 1
                    for c_item in w_contacts:
                        discovered_for_company.append(c_item)
                        if c_item['type'] == 'MOBILE': total_discovered_mobiles += 1
                        elif c_item['type'] == 'LANDLINE': total_discovered_landlines += 1
                        elif c_item['type'] == 'EMAIL': total_discovered_emails += 1
            elif args.discover_candidates:
                # Generate and test candidate domains
                cands = candidate_domains(name)
                for cand in cands[:2]: # Test top 2 candidate domains max to stay polite
                    web_insp = inspect_candidate_domain(cand, cui, reg_com, county, name)
                    if web_insp:
                        w_status, w_conf, w_url, w_contacts, _ = web_insp
                        if w_status in ('OFFICIAL_WEBSITE', 'CANDIDATE_REVIEW'):
                            website_found = w_url
                            discovered_for_company.append({
                                'type': 'WEBSITE',
                                'value': cand,
                                'normalized': w_url,
                                'label': 'OFFICE',
                                'source': 'PUBLIC_DOMAIN_DISCOVERY',
                                'provenance': w_url,
                                'method': 'MULTI_SIGNAL_IDENTITY_MATCH',
                                'status': w_status,
                                'confidence': w_conf,
                                'notes': f'Domeniu web identificat prin verificare multi-semnal ({w_status})'
                            })
                            total_discovered_websites += 1
                            for c_item in w_contacts:
                                discovered_for_company.append(c_item)
                                if c_item['type'] == 'MOBILE': total_discovered_mobiles += 1
                                elif c_item['type'] == 'LANDLINE': total_discovered_landlines += 1
                                elif c_item['type'] == 'EMAIL': total_discovered_emails += 1
                            break # Found confirmed domain

            # C. Persist contacts in local SQLite & prepare D1 SQL
            for contact in discovered_for_company:
                c.execute("""
                    INSERT INTO contact_records (
                        cui, contact_type, contact_value, normalized_value, label,
                        source_name, provenance_url, verification_method, verification_status,
                        confidence_score, notes, discovered_at, last_checked_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
                        normalized_value = excluded.normalized_value,
                        verification_status = excluded.verification_status,
                        confidence_score = MAX(confidence_score, excluded.confidence_score),
                        provenance_url = excluded.provenance_url,
                        last_checked_at = CURRENT_TIMESTAMP
                """, (
                    cui, contact['type'], contact['value'], contact['normalized'],
                    contact.get('label', 'OFFICE'), contact['source'], contact['provenance'],
                    contact.get('method', 'REGISTRY_QUERY_MATCH'), contact['status'],
                    contact['confidence'], contact.get('notes', '')
                ))

                clean_val = contact['value'].replace("'", "''")
                clean_norm = contact['normalized'].replace("'", "''")
                clean_notes = contact.get('notes', '').replace("'", "''")
                clean_prov = contact['provenance'].replace("'", "''")
                d1_sql_statements.append(f"""
                    INSERT INTO contact_records (
                        cui, contact_type, contact_value, normalized_value, label,
                        source_name, provenance_url, verification_method, verification_status,
                        confidence_score, notes, discovered_at, last_checked_at
                    ) VALUES (
                        {cui}, '{contact['type']}', '{clean_val}', '{clean_norm}', '{contact.get('label', 'OFFICE')}',
                        '{contact['source']}', '{clean_prov}', '{contact.get('method', 'REGISTRY_QUERY_MATCH')}',
                        '{contact['status']}', {contact['confidence']}, '{clean_notes}',
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    ) ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
                        normalized_value = excluded.normalized_value,
                        verification_status = excluded.verification_status,
                        confidence_score = MAX(confidence_score, excluded.confidence_score),
                        provenance_url = excluded.provenance_url,
                        last_checked_at = CURRENT_TIMESTAMP;
                """)

            # Update company status
            if discovered_for_company:
                status_val = 'CONTACT_FOUND'
                web_update = f", website = '{website_found}'" if website_found else ""
                c.execute(f"""
                    UPDATE companies 
                    SET contact_checked_at = CURRENT_TIMESTAMP,
                        contact_check_status = ?,
                        contact_check_sources = ?
                        {web_update}
                    WHERE cui = ?
                """, (status_val, ','.join(checked_sources), cui))
                d1_sql_statements.append(f"""
                    UPDATE companies 
                    SET contact_checked_at = CURRENT_TIMESTAMP,
                        contact_check_status = '{status_val}',
                        contact_check_sources = '{','.join(checked_sources)}'
                        {web_update}
                    WHERE cui = {cui};
                """)
                print(f"  [+] CUI {cui} ({name[:25]}...): Discovered {len(discovered_for_company)} contacts")
            else:
                status_val = 'NO_PUBLIC_CONTACT'
                total_without_contacts += 1
                c.execute("""
                    UPDATE companies 
                    SET contact_checked_at = CURRENT_TIMESTAMP,
                        contact_check_status = ?,
                        contact_check_sources = ?
                    WHERE cui = ?
                """, (status_val, ','.join(checked_sources), cui))
                d1_sql_statements.append(f"""
                    UPDATE companies 
                    SET contact_checked_at = CURRENT_TIMESTAMP,
                        contact_check_status = '{status_val}',
                        contact_check_sources = '{','.join(checked_sources)}'
                    WHERE cui = {cui};
                """)

        conn.commit()

        # Update durable job state
        checked_count = c.execute("SELECT count(*) FROM companies WHERE contact_checked_at IS NOT NULL").fetchone()[0]
        remaining_count = total_companies - checked_count
        companies_with_contact = c.execute("SELECT count(DISTINCT cui) FROM contact_records").fetchone()[0]

        c.execute("""
            UPDATE enrichment_job_state
            SET companies_checked = ?,
                companies_remaining = ?,
                companies_with_contact = ?,
                companies_without_contact = companies_without_contact + ?,
                new_mobiles = new_mobiles + ?,
                new_landlines = new_landlines + ?,
                new_emails = new_emails + ?,
                new_websites = new_websites + ?,
                failed_requests = failed_requests + ?,
                rate_limited_requests = rate_limited_requests + ?,
                last_processed_cui = ?,
                last_batch_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'BULK_ENRICHMENT_JOB'
        """, (
            checked_count, remaining_count, companies_with_contact,
            len([r for r in batch if r['cui'] not in anaf_results or not anaf_results[r['cui']].get('telefon')]),
            total_discovered_mobiles, total_discovered_landlines, total_discovered_emails, total_discovered_websites,
            failed_requests_count, rate_limited_count, cuis[-1]
        ))
        conn.commit()

        # Sync file for Cloudflare D1
        sync_pending_file = 'migrations/0007_bulk_enrichment_sync.sql'
        if d1_sql_statements:
            with open(sync_pending_file, 'a') as f:
                f.write('\n'.join(d1_sql_statements) + '\n')

        print(f"Progress: {checked_count}/{total_companies} checked ({checked_count*100/total_companies:.1f}%), {companies_with_contact} with contacts")
        time.sleep(1.0) # Polite delay between batches

    # Mark COMPLETED if all finished
    checked_count = c.execute("SELECT count(*) FROM companies WHERE contact_checked_at IS NOT NULL").fetchone()[0]
    final_status = 'COMPLETED' if checked_count >= total_companies else 'PAUSED'
    c.execute("UPDATE enrichment_job_state SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'BULK_ENRICHMENT_JOB'", (final_status,))
    conn.commit()

    # Append job state update to migration 0007
    unique_contacts_co = c.execute('SELECT count(DISTINCT cui) FROM contact_records').fetchone()[0]
    mobiles_co = c.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'MOBILE'").fetchone()[0]
    landlines_co = c.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'LANDLINE'").fetchone()[0]
    emails_co = c.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'EMAIL'").fetchone()[0]
    websites_co = c.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'WEBSITE'").fetchone()[0]
    no_contacts_co = c.execute("SELECT count(*) FROM companies WHERE contact_check_status = 'NO_PUBLIC_CONTACT'").fetchone()[0]
    
    d1_job_state_sql = f"""
UPDATE enrichment_job_state 
SET status = '{final_status}',
    companies_checked = {checked_count},
    companies_remaining = {total_companies - checked_count},
    companies_with_contact = {unique_contacts_co},
    companies_without_contact = {no_contacts_co},
    new_mobiles = {mobiles_co},
    new_landlines = {landlines_co},
    new_emails = {emails_co},
    new_websites = {websites_co},
    last_batch_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'BULK_ENRICHMENT_JOB';
"""
    with open('migrations/0007_bulk_enrichment_sync.sql', 'a') as f:
        f.write(d1_job_state_sql + '\n')

    print("\n=================================================================")
    print("                 ENRICHMENT BATCH RUN COMPLETE                   ")
    print("=================================================================")
    print(f"Final Status:                  {final_status}")
    print(f"Companies Checked:             {checked_count} / {total_companies}")
    print(f"Companies with Usable Contact: {c.execute('SELECT count(DISTINCT cui) FROM contact_records').fetchone()[0]}")
    print("=================================================================")

if __name__ == '__main__':
    main()
