#!/usr/bin/env python3
"""
BUSINESS RADAR — Comprehensive Company Legal, Fiscal & Evidence Verification Engine
Processes all 2,908 companies against the official synchronous ANAF v9 endpoint:
https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva

- Strict legal status classification from official registration state (ANAF Fiscal Register)
- Strict fiscal status classification (Fiscally Active vs Inactive with historical reactivation dates)
- e-Factura compliance parsing
- Audit evidence persistence in company_status_evidence
- Declared contact discovery and normalization
- Strict central eligibility evaluation
- D1 SQL migration file generation
"""

import sys
import os
import sqlite3
import json
import urllib.request
import urllib.error
import re
import time
import argparse
import functools
from datetime import datetime, timedelta

print = functools.partial(print, flush=True)

DB_PATH = 'data/radar_business.db'
ANAF_API_URL = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva'
USER_AGENT = 'RadarBusinessRomania/2.0 (Official Registry & Fiscal Verification)'

def normalize_phone(raw):
    if not raw:
        return None
    cleaned = re.sub(r'[^\d+]', '', str(raw).strip())
    if cleaned.startswith('0040'):
        cleaned = '+40' + cleaned[4:]
    elif cleaned.startswith('40') and len(cleaned) == 11 and cleaned[2] in '237':
        cleaned = '+40' + cleaned[2:]
    elif cleaned.startswith('0') and len(cleaned) == 10 and cleaned[1] in '237':
        cleaned = '+40' + cleaned[1:]
    
    if re.match(r'^\+407\d{8}$', cleaned):
        return {'normalized': cleaned, 'type': 'MOBILE', 'is_valid': True}
    if re.match(r'^\+40[23]\d{8}$', cleaned):
        return {'normalized': cleaned, 'type': 'LANDLINE', 'is_valid': True}
    return None

def parse_legal_status(raw_stare):
    if not raw_stare or not str(raw_stare).strip():
        return {'status': 'UNKNOWN', 'desc': 'Stare juridică nespecificată în registrul fiscal', 'date': None}
    
    norm = str(raw_stare).strip().upper()
    status_date = None
    date_match = re.search(r'(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})', norm)
    if date_match:
        status_date = f"{date_match.group(3)}-{date_match.group(2)}-{date_match.group(1)}"
    
    if 'RADIERE' in norm or 'RADIAT' in norm:
        return {'status': 'RADIATED', 'desc': str(raw_stare).strip(), 'date': status_date}
    if 'SUSPENDARE' in norm or 'SUSPENDAT' in norm:
        return {'status': 'SUSPENDED', 'desc': str(raw_stare).strip(), 'date': status_date}
    if 'DIZOLVARE' in norm or 'DIZOLVAT' in norm:
        return {'status': 'DISSOLVED', 'desc': str(raw_stare).strip(), 'date': status_date}
    if any(k in norm for k in ['LICHIDARE', 'FALIMENT', 'INSOLVENT', 'REORGANIZARE']):
        return {'status': 'IN_LIQUIDATION', 'desc': str(raw_stare).strip(), 'date': status_date}
    if any(k in norm for k in ['INREGISTRAT', 'FUNCTIONARE', 'AUTORIZAT', 'ACTIVA']):
        return {'status': 'ACTIVE', 'desc': str(raw_stare).strip(), 'date': status_date}
    
    return {'status': 'UNKNOWN', 'desc': str(raw_stare).strip(), 'date': status_date}

def parse_fiscal_status(inactiv_data):
    if not inactiv_data:
        return {'status': 'UNKNOWN', 'inact_date': None, 'react_date': None}
    
    is_inactiv = bool(inactiv_data.get('statusInactivi'))
    inact_date = inactiv_data.get('dataInactivare')
    react_date = inactiv_data.get('dataReactivare')
    if inact_date: inact_date = str(inact_date).strip() or None
    if react_date: react_date = str(react_date).strip() or None

    if is_inactiv:
        return {'status': 'FISCALLY_INACTIVE', 'inact_date': inact_date, 'react_date': react_date}
    
    # Not currently inactive
    if react_date:
        # Currently active, but has a historical reactivation event
        return {'status': 'FISCALLY_ACTIVE', 'inact_date': inact_date, 'react_date': react_date}
    
    return {'status': 'FISCALLY_ACTIVE', 'inact_date': inact_date, 'react_date': react_date}

def evaluate_commercial_evidence(financial, incorporation_date):
    if financial and financial.get('fiscal_year'):
        year = financial['fiscal_year']
        turnover = financial.get('turnover') or 0
        employees = financial.get('employees_avg') or 0
        if year >= 2022:
            if turnover > 0:
                return 'ACTIVE_COMMERCIAL_EVIDENCE'
            else:
                return 'LIMITED_COMMERCIAL_EVIDENCE'
        else:
            return 'HISTORICAL_ACTIVITY_ONLY'
    
    if incorporation_date:
        m = re.search(r'(\d{4})', str(incorporation_date))
        if m and int(m.group(1)) >= 2023:
            return 'NEW_COMPANY'
            
    return 'NO_FINANCIAL_EVIDENCE'

def evaluate_eligibility(legal_status, fiscal_status, comm_evidence, has_usable_phone, is_suppressed):
    reasons = []
    
    # 1. Legal status
    if legal_status == 'RADIATED':
        reasons.append('Companie radiată conform registrului fiscal')
    elif legal_status == 'SUSPENDED':
        reasons.append('Activitate suspendată conform registrului fiscal')
    elif legal_status == 'DISSOLVED':
        reasons.append('Companie dizolvată')
    elif legal_status == 'IN_LIQUIDATION':
        reasons.append('Companie în procedură de lichidare/insolvență')
    elif legal_status == 'UNKNOWN':
        reasons.append('Stare juridică neverificată')
    elif legal_status == 'VERIFICATION_ERROR':
        reasons.append('Eroare tehnică la verificarea stării juridice')

    # 2. Fiscal status
    if fiscal_status == 'FISCALLY_INACTIVE':
        reasons.append('Companie inactivă fiscal în evidențele ANAF')
    elif fiscal_status == 'UNKNOWN':
        reasons.append('Stare fiscală neverificată la ANAF')
    elif fiscal_status == 'VERIFICATION_ERROR':
        reasons.append('Eroare la interogarea bazei de date fiscale ANAF')

    # 3. Commercial activity evidence (STRICT RULE)
    if comm_evidence != 'ACTIVE_COMMERCIAL_EVIDENCE':
        if comm_evidence == 'NEW_COMPANY':
            reasons.append('Companie nouă (fără bilanț anual finalizat - încadrată în coada de startup-uri)')
        elif comm_evidence == 'LIMITED_COMMERCIAL_EVIDENCE':
            reasons.append('Evidență comercială limitată (cifră de afaceri zero sau fără salariați)')
        elif comm_evidence == 'HISTORICAL_ACTIVITY_ONLY':
            reasons.append('Doar date financiare istorice anterioare anului 2022')
        else:
            reasons.append('Lipsă evidență bilanț financiar recent la Ministerul Finanțelor')

    # 4. Usable Contact
    if not has_usable_phone:
        reasons.append('Fără număr de telefon funcțional sau verificat')

    # 5. Suppression
    if is_suppressed:
        reasons.append('Companie sau contact inclus în lista de suprimare (Do Not Contact)')

    is_eligible = (len(reasons) == 0)
    return is_eligible, '; '.join(reasons) if reasons else None

def call_anaf(cuis, date_str='2025-11-01', timeout=40):
    payload = [{'cui': int(c), 'data': date_str} for c in cuis]
    req = urllib.request.Request(
        ANAF_API_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'User-Agent': USER_AGENT}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        found_map = {}
        for item in data.get('found', []):
            dg = item.get('date_generale', {})
            c = dg.get('cui')
            if c:
                found_map[int(c)] = item
        return found_map

def main():
    parser = argparse.ArgumentParser(description="Comprehensive Legal & Fiscal Verification")
    parser.add_argument('--batch-size', type=int, default=10, help="Batch size per ANAF request (default: 10)")
    parser.add_argument('--max-batches', type=int, default=0, help="Max batches (0 = all)")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    total_companies = c.execute("SELECT count(*) FROM companies").fetchone()[0]
    already_checked = c.execute("SELECT count(*) FROM companies WHERE last_status_check_at IS NOT NULL").fetchone()[0]
    remaining = total_companies - already_checked

    print("=================================================================")
    print("   BUSINESS RADAR — OFFICIAL COMPREHENSIVE VERIFICATION ENGINE   ")
    print("=================================================================")
    print(f"Total Companies in DB:    {total_companies}")
    print(f"Already Checked:          {already_checked}")
    print(f"Remaining to Check:       {remaining}")
    print(f"Batch Size:               {args.batch_size}")
    print("=================================================================\n")

    batches_run = 0
    total_active_eligible = 0
    total_radiated = 0
    total_fiscally_inactive = 0
    total_suspended_dissolved = 0
    total_evidence_rows = 0
    total_contacts_discovered = 0
    d1_sql_statements = []

    sql_out_path = 'migrations/0011_verified_all_companies_and_evidence.sql'
    file_exists = os.path.exists(sql_out_path)
    sql_file = open(sql_out_path, 'a', encoding='utf-8')
    if not file_exists:
        sql_file.write("-- Migration 0011: Verified All Companies Status & Evidence Audit Records\n")
        sql_file.write("-- Auto-generated by verify_all_companies.py against official ANAF v9 endpoint\n\n")

    while True:
        if args.max_batches > 0 and batches_run >= args.max_batches:
            print(f"[INFO] Reached requested limit of {args.max_batches} batches.")
            break

        c.execute("""
            SELECT cui, name, primary_caen, incorporation_date
            FROM companies
            WHERE last_status_check_at IS NULL
            ORDER BY cui ASC
            LIMIT ?
        """, (args.batch_size,))
        batch = c.fetchall()

        if not batch:
            print("[INFO] All companies have been processed!")
            break

        batches_run += 1
        cuis = [row['cui'] for row in batch]
        print(f"Batch {batches_run}: Checking {len(cuis)} companies (CUI {cuis[0]} .. {cuis[-1]})...")

        anaf_map = {}
        provider_failed = False
        try:
            anaf_map = call_anaf(cuis)
        except Exception as e:
            print(f"  [WARN] Batch request failed ({e}). Retrying with 2 sub-batches...")
            time.sleep(2)
            mid = len(cuis) // 2
            try:
                part1 = call_anaf(cuis[:mid])
                time.sleep(1)
                part2 = call_anaf(cuis[mid:])
                anaf_map = {**part1, **part2}
            except Exception as e2:
                print(f"  [ERROR] Sub-batch fallback failed: {e2}")
                provider_failed = True

        now_iso = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        query_iso = datetime.utcnow().isoformat()
        next_due = (datetime.utcnow() + timedelta(days=90)).strftime('%Y-%m-%d')

        for row in batch:
            cui = row['cui']
            inc_date = row['incorporation_date']

            # Check existing suppression
            supp = c.execute("SELECT 1 FROM suppression_list WHERE cui = ?", (cui,)).fetchone()
            is_suppressed = bool(supp)

            # Check financial records
            fin = c.execute("SELECT * FROM financial_records WHERE cui = ? ORDER BY fiscal_year DESC LIMIT 1", (cui,)).fetchone()
            comm_evidence = evaluate_commercial_evidence(dict(fin) if fin else None, inc_date)

            if provider_failed:
                # Never report a company as checked when provider returned an error!
                c.execute("""
                    INSERT INTO company_status_evidence (
                        cui, source_name, source_url, query_timestamp, response_timestamp,
                        status_returned, verification_method, provider_error, verified_by
                    ) VALUES (?, 'ANAF_PLATITOR_TVA_REST_V9', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
                              ?, ?, 'PROVIDER_ERROR', 'OFFICIAL_SYNCHRONOUS_REST_API', 'CONNECTION_TIMEOUT', 'SYSTEM_BATCH')
                """, (cui, query_iso, query_iso))
                continue
            elif cui in anaf_map:
                item = anaf_map[cui]
                dg = item.get('date_generale', {})
                inactiv = item.get('stare_inactiv', {})

                # Legal status from registration state
                legal_res = parse_legal_status(dg.get('stare_inregistrare'))
                legal_status = legal_res['status']
                legal_desc = legal_res['desc']
                legal_date = legal_res['date']

                # Fiscal status
                fiscal_res = parse_fiscal_status(inactiv)
                fiscal_status = fiscal_res['status']
                fiscal_inact_date = fiscal_res['inact_date']
                fiscal_react_date = fiscal_res['react_date']

                is_ro_efactura = 1 if dg.get('statusRO_e_Factura') else 0
                status_source = 'ANAF_FISCAL_REGISTER'

                # Discover and persist declared phone
                tel = dg.get('telefon')
                if tel and str(tel).strip():
                    norm_phone = normalize_phone(tel)
                    if norm_phone:
                        c.execute("""
                            INSERT OR IGNORE INTO contact_records (
                                cui, contact_type, contact_value, label,
                                provenance_url, verification_status, confidence_score,
                                source_name, verification_method, notes, last_checked_at
                            ) VALUES (?, ?, ?, 'OFFICE', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'DECLARED_BY_COMPANY', 0.85, 'ANAF_OPEN_DATA', 'REGISTRY_QUERY_MATCH', 'Telefon oficial declarat în evidențele fiscale ANAF', datetime('now'))
                        """, (cui, norm_phone['type'], norm_phone['normalized']))
                        if c.rowcount > 0:
                            total_contacts_discovered += 1
                            safe_tel = norm_phone['normalized'].replace("'", "''")
                            sql_file.write(f"INSERT OR IGNORE INTO contact_records (cui, contact_type, contact_value, label, provenance_url, verification_status, confidence_score, source_name, verification_method, notes, last_checked_at) VALUES ({cui}, '{norm_phone['type']}', '{safe_tel}', 'OFFICE', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', 'DECLARED_BY_COMPANY', 0.85, 'ANAF_OPEN_DATA', 'REGISTRY_QUERY_MATCH', 'Telefon oficial declarat în evidențele fiscale ANAF', datetime('now'));\n")
            else:
                legal_status = 'UNKNOWN'
                legal_desc = 'CUI negăsit în evidențele fiscale ANAF'
                legal_date = None
                fiscal_status = 'UNKNOWN'
                fiscal_inact_date = None
                fiscal_react_date = None
                is_ro_efactura = 0
                status_source = 'ANAF_NOT_FOUND'

            # Usable phone check
            contact_row = c.execute("""
                SELECT contact_value, verification_status
                FROM contact_records
                WHERE cui = ? AND contact_type IN ('MOBILE', 'LANDLINE')
                  AND verification_status NOT IN ('INVALID_NUMBER', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED')
                LIMIT 1
            """, (cui,)).fetchone()
            has_usable_phone = bool(contact_row)

            # Evaluate central eligibility
            is_eligible, reasons = evaluate_eligibility(
                legal_status, fiscal_status, comm_evidence, has_usable_phone, is_suppressed
            )

            if is_eligible: total_active_eligible += 1
            if legal_status == 'RADIATED': total_radiated += 1
            if fiscal_status == 'FISCALLY_INACTIVE': total_fiscally_inactive += 1
            if legal_status in ('SUSPENDED', 'DISSOLVED', 'IN_LIQUIDATION'): total_suspended_dissolved += 1

            # Update companies table locally
            c.execute("""
                UPDATE companies
                SET legal_status = ?,
                    legal_status_desc = ?,
                    legal_status_date = ?,
                    fiscal_status = ?,
                    fiscal_inactivation_date = ?,
                    fiscal_reactivation_date = ?,
                    ro_e_factura = ?,
                    commercial_evidence_status = ?,
                    is_calling_eligible = ?,
                    ineligibility_reasons = ?,
                    last_status_check_at = ?,
                    status_verification_source = ?,
                    onrc_status = 'ONRC_UNVERIFIED'
                WHERE cui = ?
            """, (
                legal_status, legal_desc, legal_date,
                fiscal_status, fiscal_inact_date, fiscal_react_date,
                is_ro_efactura, comm_evidence,
                1 if is_eligible else 0,
                reasons, now_iso, status_source,
                cui
            ))

            # Record audit evidence row
            evidence_status = f"LEGAL:{legal_status}|FISCAL:{fiscal_status}|EFACTURA:{is_ro_efactura}"
            c.execute("""
                INSERT INTO company_status_evidence (
                    cui, source_name, source_url, query_timestamp, response_timestamp,
                    status_returned, effective_date, verification_method, raw_response_ref,
                    last_successful_verification, next_verification_due, provider_error, verified_by
                ) VALUES (?, 'ANAF_PLATITOR_TVA_REST_V9', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
                          ?, ?, ?, ?, 'OFFICIAL_SYNCHRONOUS_REST_API', ?, ?, ?, ?, 'SYSTEM_BATCH')
            """, (
                cui, query_iso, query_iso, evidence_status,
                legal_date or fiscal_inact_date,
                f"ANAF_v9_STARE: {legal_desc}",
                now_iso, next_due,
                'CONNECTION_FAILED' if provider_failed else None
            ))
            total_evidence_rows += 1

            # Format SQL for D1
            clean_desc = legal_desc.replace("'", "''") if legal_desc else ''
            clean_reasons = reasons.replace("'", "''") if reasons else ''
            clean_raw_ref = f"ANAF_v9_STARE: {clean_desc}"
            d1_sql = f"""UPDATE companies SET legal_status = '{legal_status}', legal_status_desc = '{clean_desc}', legal_status_date = {'null' if not legal_date else f"'{legal_date}'"}, fiscal_status = '{fiscal_status}', fiscal_inactivation_date = {'null' if not fiscal_inact_date else f"'{fiscal_inact_date}'"}, fiscal_reactivation_date = {'null' if not fiscal_react_date else f"'{fiscal_react_date}'"}, ro_e_factura = {is_ro_efactura}, commercial_evidence_status = '{comm_evidence}', is_calling_eligible = {1 if is_eligible else 0}, ineligibility_reasons = {'null' if not reasons else f"'{clean_reasons}'"}, last_status_check_at = '{now_iso}', status_verification_source = '{status_source}', onrc_status = 'ONRC_UNVERIFIED' WHERE cui = {cui};\n"""
            sql_file.write(d1_sql)

            d1_evidence_sql = f"""INSERT INTO company_status_evidence (cui, source_name, source_url, query_timestamp, response_timestamp, status_returned, effective_date, verification_method, raw_response_ref, last_successful_verification, next_verification_due, provider_error, verified_by) VALUES ({cui}, 'ANAF_PLATITOR_TVA_REST_V9', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', '{query_iso}', '{query_iso}', '{evidence_status}', {'null' if not (legal_date or fiscal_inact_date) else f"'{legal_date or fiscal_inact_date}'"}, 'OFFICIAL_SYNCHRONOUS_REST_API', '{clean_raw_ref}', '{now_iso}', '{next_due}', {'null' if not provider_failed else "'CONNECTION_FAILED'"}, 'SYSTEM_BATCH');\n"""
            sql_file.write(d1_evidence_sql)

        conn.commit()
        time.sleep(1.2) # Rate limit delay between requests

    sql_file.close()

    total_verified = c.execute("SELECT count(*) FROM companies WHERE last_status_check_at IS NOT NULL").fetchone()[0]
    total_eligible = c.execute("SELECT count(*) FROM companies WHERE is_calling_eligible = 1").fetchone()[0]
    total_excluded = c.execute("SELECT count(*) FROM companies WHERE is_calling_eligible = 0").fetchone()[0]
    tot_rad = c.execute("SELECT count(*) FROM companies WHERE legal_status = 'RADIATED'").fetchone()[0]
    tot_fisc_inact = c.execute("SELECT count(*) FROM companies WHERE fiscal_status = 'FISCALLY_INACTIVE'").fetchone()[0]
    tot_susp = c.execute("SELECT count(*) FROM companies WHERE legal_status = 'SUSPENDED'").fetchone()[0]
    tot_diss = c.execute("SELECT count(*) FROM companies WHERE legal_status = 'DISSOLVED'").fetchone()[0]
    tot_evidence = c.execute("SELECT count(*) FROM company_status_evidence").fetchone()[0]

    print("\n=================================================================")
    print("   VERIFICATION RUN COMPLETED SUCCESSFULLY                      ")
    print("=================================================================")
    print(f"Total Companies:               {total_companies}")
    print(f"Total Verified by Engine:      {total_verified}")
    print(f"Calling Queue Eligible:        {total_eligible}")
    print(f"Excluded from Calling Queue:   {total_excluded}")
    print(f"Total Radiated Companies:      {tot_rad}")
    print(f"Total Fiscally Inactive:       {tot_fisc_inact}")
    print(f"Total Suspended:               {tot_susp}")
    print(f"Total Dissolved:               {tot_diss}")
    print(f"Audit Evidence Records Stored: {tot_evidence}")
    print(f"D1 SQL Generated:              {sql_out_path}")
    print("=================================================================\n")

    conn.close()

if __name__ == '__main__':
    main()
