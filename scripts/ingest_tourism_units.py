#!/usr/bin/env python3
"""
Ingestion script for National Classified Tourism Units Portfolio (UNITĂȚI TURISTICE).
Imports all 30,874 records from data/lista_structuri_turistice_clasificate.xlsm into data/radar_business.db.
Preserves all 16 original fields faithfully, maintains historical invariants, and operates idempotently.
"""

import sys
import os
import json
import sqlite3
import hashlib
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime

XLSM_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "lista_structuri_turistice_clasificate.xlsm")
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "radar_business.db")

SOURCE_FILENAME = "Lista-structurilor-de-primire-turistice-cu-functiuni-de-cazare-clasificate-actualizata-la-08.06.2026.xlsm"

def main():
    print("================================================================================")
    print("BUSINESS RADAR — INGESTIE PORTFOLIO UNITĂȚI TURISTICE")
    print(f"Sursă: {XLSM_PATH}")
    print(f"Destinație SQLite: {DB_PATH}")
    print("================================================================================")

    if not os.path.exists(XLSM_PATH):
        print(f"EROARE: Fișierul sursă {XLSM_PATH} nu există!")
        sys.exit(1)

    if not os.path.exists(DB_PATH):
        print(f"EROARE: Baza de date {DB_PATH} nu există!")
        sys.exit(1)

    # 1. Open Database & Check Invariants Pre-Import
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT count(*) FROM companies;")
    pre_companies = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM prospect_records WHERE portfolio_type = 'GENERAL';")
    pre_general = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM prospect_records WHERE portfolio_type = 'NICHE_HORECA_AUTO_CONSTRUCT';")
    pre_niche = cur.fetchone()[0]

    print(f"Invarianți Pre-Import:")
    print(f"  - Companii istorice ONRC : {pre_companies} (Așteptat: 2908)")
    print(f"  - Portofoliu GENERAL     : {pre_general} (Așteptat: 304)")
    print(f"  - Portofoliu NICHE       : {pre_niche} (Așteptat: 25)")

    if pre_companies != 2908 or pre_general != 304 or pre_niche != 25:
        print("EROARE: Invarianții pre-import nu corespund! Oprire de urgență.")
        sys.exit(1)

    # 2. Parse Shared Strings
    print("\nParsare dicționar sharedStrings.xml...")
    with zipfile.ZipFile(XLSM_PATH) as z:
        with z.open("xl/sharedStrings.xml") as f:
            tree = ET.parse(f)
            sst = [elem.text or "" for elem in tree.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")]
        print(f"Shared strings încărcate: {len(sst):,}")

        # 3. Stream Parse sheet1.xml and ingest
        print("\nParsare și inserare în baza de date...")
        insert_sql = """
        INSERT OR IGNORE INTO prospect_records (
            id,
            portfolio_type,
            source_file,
            source_row_index,
            raw_content,
            company_name,
            cui,
            reg_com,
            domain,
            county,
            city,
            address,
            phones,
            emails,
            website,
            commercial_status,
            decision_maker,
            operational_notes,
            is_incomplete,
            unit_type,
            unit_name,
            unit_classification,
            rooms_count,
            beds_count,
            locality_type,
            locality_subdivision,
            operator_type,
            operator_name,
            authorization_number,
            authorization_date,
            created_at,
            updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
        );
        """

        with z.open("xl/worksheets/sheet1.xml") as f:
            context = ET.iterparse(f, events=("end",))
            batch = []
            row_count = 0
            inserted_count = 0

            for event, elem in context:
                if elem.tag.endswith("row"):
                    r_idx = int(elem.attrib.get("r", 0))
                    if r_idx < 7:  # Rows 1-6 are title and headers
                        elem.clear()
                        continue

                    # Extract row cells
                    row_vals = {}
                    for c in elem.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                        col = "".join(filter(str.isalpha, c.attrib.get("r", "")))
                        v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                        if v is not None and v.text:
                            val = sst[int(v.text)] if c.attrib.get("t") == "s" else v.text
                            row_vals[col] = val.strip()

                    row_count += 1

                    # Map columns
                    unit_type = row_vals.get("A", "")
                    unit_name = row_vals.get("B", "")
                    unit_classification = row_vals.get("C", "")
                    rooms_count = row_vals.get("D", "")
                    beds_count = row_vals.get("E", "")
                    address = row_vals.get("F", "")
                    locality_type = row_vals.get("G", "")
                    locality_subdivision = row_vals.get("H", "")
                    city = row_vals.get("I", "")
                    county = row_vals.get("J", "")
                    email = row_vals.get("K", "")
                    web = row_vals.get("L", "")
                    operator_type = row_vals.get("M", "")
                    operator_name = row_vals.get("N", "")
                    reg_com = row_vals.get("O", "")
                    cui = row_vals.get("P", "")
                    auth_num = row_vals.get("Q", "")
                    auth_date = row_vals.get("R", "")

                    # Compute deterministic ID
                    id_hash = hashlib.sha256(f"{r_idx}_{operator_name}_{unit_name}_{city}_{cui}".encode("utf-8")).hexdigest()[:12]
                    record_id = f"pr_tour_{r_idx}_{id_hash}"

                    # Display name for company_name: Unit Name (or Operator Name)
                    company_name = unit_name if unit_name else (operator_name if operator_name else f"Unitate #{r_idx}")

                    # Raw content JSON preserving all original columns verbatim
                    raw_dict = {
                        "tip_unitate": unit_type,
                        "nume_unitate": unit_name,
                        "tip_categorie": unit_classification,
                        "numar_spatii": rooms_count,
                        "numar_locuri": beds_count,
                        "alte_detalii_adresa": address,
                        "tip_localitate": locality_type,
                        "localitate_componenta": locality_subdivision,
                        "localitate": city,
                        "judet": county,
                        "email": email,
                        "web": web,
                        "tip_operator_economic": operator_type,
                        "operator_economic": operator_name,
                        "numar_inregistrare": reg_com,
                        "cod_unic_inregistrare": cui,
                        "numar_autorizatie": auth_num,
                        "data_emitere_autorizatie": auth_date,
                        "source_row": r_idx
                    }
                    raw_content_json = json.dumps(raw_dict, ensure_ascii=False)

                    # Contact arrays
                    emails_json = json.dumps([email], ensure_ascii=False) if email and email.lower() not in ("-", "#n/a", "n/a") else "[]"
                    phones_json = "[]"

                    # Operational notes
                    op_notes = f"Operator: {operator_name} ({operator_type}) | Autorizație: {auth_num} din {auth_date}" if auth_num else f"Operator: {operator_name}"

                    # Check incompleteness
                    is_incomplete = 1 if not cui or cui in ("#N/A", "N/A", "-") or not email else 0

                    batch.append((
                        record_id,
                        'TOURISM_UNITS',
                        SOURCE_FILENAME,
                        r_idx,
                        raw_content_json,
                        company_name,
                        cui if cui else None,
                        reg_com if reg_com else None,
                        'Turism & Cazare',
                        county if county else None,
                        city if city else None,
                        address if address else None,
                        phones_json,
                        emails_json,
                        web if web else None,
                        'NEW_UNVERIFIED',
                        operator_name if operator_name else None,
                        op_notes,
                        is_incomplete,
                        unit_type,
                        unit_name,
                        unit_classification,
                        rooms_count,
                        beds_count,
                        locality_type,
                        locality_subdivision,
                        operator_type,
                        operator_name,
                        auth_num,
                        auth_date
                    ))

                    if len(batch) >= 2000:
                        cur.executemany(insert_sql, batch)
                        conn.commit()
                        inserted_count += len(batch)
                        print(f"  Procesate: {inserted_count:,} / 30.874...")
                        batch = []

                    elem.clear()

            if batch:
                cur.executemany(insert_sql, batch)
                conn.commit()
                inserted_count += len(batch)
                print(f"  Procesate final: {inserted_count:,} / 30.874.")

    # 4. Post-Import Verification & Reconciliation
    cur.execute("SELECT count(*) FROM prospect_records WHERE portfolio_type = 'TOURISM_UNITS';")
    post_tourism = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM prospect_records WHERE portfolio_type = 'GENERAL';")
    post_general = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM prospect_records WHERE portfolio_type = 'NICHE_HORECA_AUTO_CONSTRUCT';")
    post_niche = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM companies;")
    post_companies = cur.fetchone()[0]

    print("\n================================================================================")
    print("RAPORT DE RECONCILIERE DUPĂ IMPORT")
    print("================================================================================")
    print(f"Portofoliu UNITĂȚI TURISTICE : {post_tourism:,} (Așteptat: 30,874)")
    print(f"Portofoliu GENERAL (intact)  : {post_general} (Așteptat: 304)")
    print(f"Portofoliu NICHE (intact)    : {post_niche} (Așteptat: 25)")
    print(f"Companii istorice (intact)   : {post_companies} (Așteptat: 2,908)")

    if post_tourism == 30874 and post_general == 304 and post_niche == 25 and post_companies == 2908:
        print("\nSUCCES TOTAL: Toate cele 30.874 de unități turistice au fost importate cu succes!")
        print("Toți invarianții au fost protejați cu succes (304 GENERAL, 25 NICHE, 2908 ISTORICE).")
    else:
        print("\nAVERTISMENT: Reconcilierea numerelor nu este identică cu ținta!")

    conn.close()

if __name__ == "__main__":
    main()
