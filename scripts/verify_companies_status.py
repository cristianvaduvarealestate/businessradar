#!/usr/bin/env python3
"""
BUSINESS RADAR — Official Company Legal & Fiscal Verification Engine
Interrogates official ANAF / ONRC records to classify:
- Legal Status (ACTIVE, RADIATED, SUSPENDED, DISSOLVED, IN_LIQUIDATION, UNKNOWN)
- Fiscal Status (FISCALLY_ACTIVE, FISCALLY_INACTIVE, REACTIVATED, UNKNOWN)
- e-Factura compliance
- Commercial activity evidence & calling queue eligibility
Syncs verified statuses to local SQLite and generates SQL for Cloudflare D1.
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
from datetime import datetime

print = functools.partial(print, flush=True)

DB_PATH = 'data/radar_business.db'
ANAF_API_URL = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva'
USER_AGENT = 'RadarBusinessRomania/2.0 (Official Registry & Fiscal Verification)'

def parse_legal_status(raw_stare):
    if not raw_stare or not str(raw_stare).strip():
        return {'status': 'UNKNOWN', 'desc': 'Stare juridică nespecificată', 'date': None}
    
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
        if inact_date and react_date and react_date > inact_date:
            return {'status': 'REACTIVATED', 'inact_date': inact_date, 'react_date': react_date}
        return {'status': 'FISCALLY_INACTIVE', 'inact_date': inact_date, 'react_date': react_date}
    
    if react_date:
        return {'status': 'REACTIVATED', 'inact_date': inact_date, 'react_date': react_date}
    
    return {'status': 'FISCALLY_ACTIVE', 'inact_date': inact_date, 'react_date': react_date}

def evaluate_commercial_evidence(financial, incorporation_date):
    if financial and financial.get('fiscal_year'):
        year = financial['fiscal_year']
        turnover = financial.get('turnover') or 0
        employees = financial.get('employees_avg') or 0
        if year >= 2020:
            if turnover > 0:
                return 'ACTIVE_COMMERCIAL_EVIDENCE'
            else:
                return 'LIMITED_COMMERCIAL_EVIDENCE'
        else:
            return 'HISTORICAL_ACTIVITY_ONLY'
    
    if incorporation_date:
        m = re.search(r'(\d{4})', str(incorporation_date))
        if m and int(m.group(1)) >= 2022:
            return 'NEW_COMPANY'
            
    return 'NO_FINANCIAL_EVIDENCE'

def evaluate_eligibility(legal_status, fiscal_status, comm_evidence, has_contact, is_suppressed):
    reasons = []
    if legal_status == 'RADIATED':
        reasons.append('Companie radiată din Registrul Comerțului (ONRC)')
    elif legal_status == 'SUSPENDED':
        reasons.append('Activitate suspendată la Registrul Comerțului')
    elif legal_status == 'DISSOLVED':
        reasons.append('Companie dizolvată')
    elif legal_status == 'IN_LIQUIDATION':
        reasons.append('Companie în procedură de lichidare/insolvență')
    elif legal_status == 'UNKNOWN':
        reasons.append('Stare juridică neverificată la Registrul Comerțului')
    elif legal_status == 'VERIFICATION_ERROR':
        reasons.append('Eroare tehnică la verificarea stării juridice')
    
    if fiscal_status == 'FISCALLY_INACTIVE':
        reasons.append('Companie inactivă fiscal în evidențele ANAF')
    elif fiscal_status == 'UNKNOWN':
        reasons.append('Stare fiscală neverificată la ANAF')
    elif fiscal_status == 'VERIFICATION_ERROR':
        reasons.append('Eroare la interogarea bazei de date fiscale ANAF')
    
    if is_suppressed:
        reasons.append('Companie inclusă în lista de suprimare (Do Not Contact)')
    
    if not has_contact:
        reasons.append('Fără număr de telefon sau canal de contact valid')
    
    is_eligible = (len(reasons) == 0)
    return is_eligible, '; '.join(reasons) if reasons else None

def call_anaf(cuis, date_str='2025-11-01', timeout=30):
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
    parser = argparse.ArgumentParser(description="Official Company Legal & Fiscal Verification")
    parser.add_argument('--batch-size', type=int, default=25, help="Batch size per ANAF request (default: 25)")
    parser.add_argument('--max-batches', type=int, default=0, help="Max batches (0 = all)")
    parser.add_argument('--prioritize-contacts', action='store_true', help="Prioritize companies with contacts first")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    total_companies = c.execute("SELECT count(*) FROM companies").fetchone()[0]
    verified_count = c.execute("SELECT count(*) FROM companies WHERE last_status_check_at IS NOT NULL").fetchone()[0]
    remaining = total_companies - verified_count

    print("=================================================================")
    print("   BUSINESS RADAR — OFFICIAL LEGAL & FISCAL VERIFICATION ENGINE  ")
    print("=================================================================")
    print(f"Total Companies in DB:    {total_companies}")
    print(f"Already Verified:         {verified_count}")
    print(f"Remaining to Verify:      {remaining}")
    print(f"Batch Size:               {args.batch_size}")
    print("=================================================================\n")

    batches_run = 0
    total_active_eligible = 0
    total_radiated = 0
    total_fiscally_inactive = 0
    total_suspended_dissolved = 0
    d1_sql_statements = []

    order_clause = "cui ASC"
    if args.prioritize_contacts:
        order_clause = "(SELECT count(*) FROM contact_records cr WHERE cr.cui = companies.cui) DESC, opportunity_score DESC, cui ASC"

    while True:
        if args.max_batches > 0 and batches_run >= args.max_batches:
            print(f"[INFO] Reached requested limit of {args.max_batches} batches.")
            break

        c.execute(f"""
            SELECT cui, name, primary_caen, incorporation_date
            FROM companies
            WHERE last_status_check_at IS NULL
            ORDER BY {order_clause}
            LIMIT ?
        """, (args.batch_size,))
        batch = c.fetchall()

        if not batch:
            print("[INFO] All eligible companies have been verified!")
            break

        batches_run += 1
        cuis = [row['cui'] for row in batch]
        print(f"Batch {batches_run}: Checking {len(cuis)} companies (CUI {cuis[0]} .. {cuis[-1]})...")

        anaf_map = {}
        provider_failed = False
        try:
            anaf_map = call_anaf(cuis)
        except Exception as e:
            print(f"  [!] Chunk failed ({e}). Splitting into smaller sub-chunks...")
            time.sleep(2)
            try:
                mid = len(cuis) // 2
                m1 = call_anaf(cuis[:mid])
                time.sleep(1.5)
                m2 = call_anaf(cuis[mid:])
                anaf_map = {**m1, **m2}
            except Exception as e2:
                print(f"  [-] ANAF Service Unavailable: {e2}")
                provider_failed = True

        for row in batch:
            cui = row['cui']
            inc_date = row['incorporation_date']
            
            # Check contact records
            contact_row = c.execute("""
                SELECT count(*) FROM contact_records 
                WHERE cui = ? AND verification_status NOT IN ('UNREACHABLE', 'INVALID', 'WRONG_NUMBER')
            """, (cui,)).fetchone()
            has_contact = bool(contact_row[0] > 0)

            # Check suppression
            supp_row = c.execute("SELECT count(*) FROM suppression_list WHERE cui = ?", (cui,)).fetchone()
            is_suppressed = bool(supp_row[0] > 0)

            # Check financials
            fin_row = c.execute("SELECT * FROM financial_records WHERE cui = ? ORDER BY fiscal_year DESC LIMIT 1", (cui,)).fetchone()
            fin_dict = dict(fin_row) if fin_row else None
            comm_evidence = evaluate_commercial_evidence(fin_dict, inc_date)

            if provider_failed:
                legal_status = 'VERIFICATION_ERROR'
                legal_desc = 'Eroare conexiune serviciu ANAF'
                legal_date = None
                fiscal_status = 'VERIFICATION_ERROR'
                fisc_inact_date = None
                fisc_react_date = None
                ro_e_factura = 0
            elif cui in anaf_map:
                item = anaf_map[cui]
                dg = item.get('date_generale', {})
                inac = item.get('stare_inactiv', {})
                legal_res = parse_legal_status(dg.get('stare_inregistrare'))
                legal_status = legal_res['status']
                legal_desc = legal_res['desc']
                legal_date = legal_res['date']
                
                fisc_res = parse_fiscal_status(inac)
                fiscal_status = fisc_res['status']
                fisc_inact_date = fisc_res['inact_date']
                fisc_react_date = fisc_res['react_date']
                ro_e_factura = 1 if dg.get('statusRO_e_Factura') else 0
            else:
                legal_status = 'UNKNOWN'
                legal_desc = 'Negăsit în baza de date fiscală ANAF'
                legal_date = None
                fiscal_status = 'UNKNOWN'
                fisc_inact_date = None
                fisc_react_date = None
                ro_e_factura = 0

            is_eligible, reasons = evaluate_eligibility(legal_status, fiscal_status, comm_evidence, has_contact, is_suppressed)

            if is_eligible:
                total_active_eligible += 1
            if legal_status == 'RADIATED':
                total_radiated += 1
            elif legal_status in ('SUSPENDED', 'DISSOLVED', 'IN_LIQUIDATION'):
                total_suspended_dissolved += 1
            if fiscal_status == 'FISCALLY_INACTIVE':
                total_fiscally_inactive += 1

            c.execute("""
                UPDATE companies SET
                    legal_status = ?,
                    legal_status_desc = ?,
                    legal_status_date = ?,
                    fiscal_status = ?,
                    fiscal_inactivation_date = ?,
                    fiscal_reactivation_date = ?,
                    ro_e_factura = ?,
                    commercial_evidence_status = ?,
                    is_calling_eligible = ?,
                    ineligibility_reasons = ?,
                    last_status_check_at = CURRENT_TIMESTAMP,
                    status_verification_source = 'ANAF_V9_API'
                WHERE cui = ?
            """, (
                legal_status, legal_desc, legal_date,
                fiscal_status, fisc_inact_date, fisc_react_date,
                ro_e_factura, comm_evidence,
                1 if is_eligible else 0,
                reasons,
                cui
            ))

            # Escape strings for SQL D1 statement
            esc_desc = legal_desc.replace("'", "''") if legal_desc else ''
            esc_date = f"'{legal_date}'" if legal_date else 'NULL'
            esc_inact = f"'{fisc_inact_date}'" if fisc_inact_date else 'NULL'
            esc_react = f"'{fisc_react_date}'" if fisc_react_date else 'NULL'
            clean_reasons = reasons.replace("'", "''") if reasons else ''
            esc_reasons = f"'{clean_reasons}'" if reasons else 'NULL'

            d1_sql_statements.append(f"""UPDATE companies SET legal_status='{legal_status}', legal_status_desc='{esc_desc}', legal_status_date={esc_date}, fiscal_status='{fiscal_status}', fiscal_inactivation_date={esc_inact}, fiscal_reactivation_date={esc_react}, ro_e_factura={ro_e_factura}, commercial_evidence_status='{comm_evidence}', is_calling_eligible={1 if is_eligible else 0}, ineligibility_reasons={esc_reasons}, last_status_check_at=CURRENT_TIMESTAMP, status_verification_source='ANAF_V9_API' WHERE cui={cui};""")

        conn.commit()
        print(f"  -> Verified: {len(batch)} | Eligible: {total_active_eligible} | Radiated: {total_radiated} | Inactive: {total_fiscally_inactive}")
        time.sleep(1.5)

    # Dump all verified companies to migrations/0009_verified_company_statuses.sql
    c.execute("""
        SELECT cui, legal_status, legal_status_desc, legal_status_date,
               fiscal_status, fiscal_inactivation_date, fiscal_reactivation_date,
               ro_e_factura, commercial_evidence_status, is_calling_eligible, ineligibility_reasons
        FROM companies
        WHERE last_status_check_at IS NOT NULL
        ORDER BY cui ASC
    """)
    verified_rows = c.fetchall()
    all_d1_statements = []
    for r in verified_rows:
        esc_desc = r['legal_status_desc'].replace("'", "''") if r['legal_status_desc'] else ''
        esc_date = f"'{r['legal_status_date']}'" if r['legal_status_date'] else 'NULL'
        esc_inact = f"'{r['fiscal_inactivation_date']}'" if r['fiscal_inactivation_date'] else 'NULL'
        esc_react = f"'{r['fiscal_reactivation_date']}'" if r['fiscal_reactivation_date'] else 'NULL'
        clean_reasons = r['ineligibility_reasons'].replace("'", "''") if r['ineligibility_reasons'] else ''
        esc_reasons = f"'{clean_reasons}'" if clean_reasons else 'NULL'
        all_d1_statements.append(
            f"UPDATE companies SET legal_status='{r['legal_status']}', legal_status_desc='{esc_desc}', legal_status_date={esc_date}, fiscal_status='{r['fiscal_status']}', fiscal_inactivation_date={esc_inact}, fiscal_reactivation_date={esc_react}, ro_e_factura={r['ro_e_factura']}, commercial_evidence_status='{r['commercial_evidence_status']}', is_calling_eligible={r['is_calling_eligible']}, ineligibility_reasons={esc_reasons}, last_status_check_at=CURRENT_TIMESTAMP, status_verification_source='ANAF_V9_API' WHERE cui={r['cui']};"
        )

    if all_d1_statements:
        os.makedirs('migrations', exist_ok=True)
        with open('migrations/0009_verified_company_statuses.sql', 'w', encoding='utf-8') as f:
            f.write('\n'.join(all_d1_statements) + '\n')
        print(f"\nWrote {len(all_d1_statements)} statements to migrations/0009_verified_company_statuses.sql")

    conn.close()

if __name__ == '__main__':
    main()
