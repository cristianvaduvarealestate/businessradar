#!/usr/bin/env python3
"""
Generate idempotent D1 SQL seed files for National Tourism Units in two safe tranches:
Tranche 1: 23,082 records with direct digital contact (email or web) < 25,000 daily limit.
Tranche 2: 7,792 records without direct digital contact.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "radar_business.db")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def sql_escape(v):
    if v is None:
        return "NULL"
    s = str(v).replace("'", "''")
    return f"'{s}'"

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cols = [
        "id", "portfolio_type", "source_file", "source_row_index", "raw_content",
        "company_name", "cui", "reg_com", "domain", "county", "city", "address",
        "phones", "emails", "website", "commercial_status", "decision_maker",
        "operational_notes", "is_incomplete", "unit_type", "unit_name",
        "unit_classification", "rooms_count", "beds_count", "locality_type",
        "locality_subdivision", "operator_type", "operator_name",
        "authorization_number", "authorization_date", "created_at", "updated_at"
    ]
    cols_joined = ", ".join(cols)

    t1_file = os.path.join(OUT_DIR, "seed_tourism_d1_tranche1.sql")
    t2_file = os.path.join(OUT_DIR, "seed_tourism_d1_tranche2.sql")

    print(f"Generare Tranșa 1 -> {t1_file}...")
    cur.execute(f"""
        SELECT {cols_joined} FROM prospect_records
        WHERE portfolio_type = 'TOURISM_UNITS' AND (emails != '[]' OR website IS NOT NULL)
        ORDER BY source_row_index ASC;
    """)
    t1_rows = cur.fetchall()

    with open(t1_file, "w", encoding="utf-8") as f:
        f.write(f"-- D1 SEED TRANCHE 1: {len(t1_rows)} records with direct contact (Email/Web)\n")
        f.write(f"-- Safe within 25,000 writes/day free limit\n\n")
        for row in t1_rows:
            vals = [sql_escape(val) for val in row]
            f.write(f"INSERT OR IGNORE INTO prospect_records ({cols_joined}) VALUES ({', '.join(vals)});\n")

    print(f"Tranșa 1 generată: {len(t1_rows):,} rânduri.")

    print(f"Generare Tranșa 2 -> {t2_file}...")
    cur.execute(f"""
        SELECT {cols_joined} FROM prospect_records
        WHERE portfolio_type = 'TOURISM_UNITS' AND emails = '[]' AND website IS NULL
        ORDER BY source_row_index ASC;
    """)
    t2_rows = cur.fetchall()

    with open(t2_file, "w", encoding="utf-8") as f:
        f.write(f"-- D1 SEED TRANCHE 2: {len(t2_rows)} records without direct digital contact\n")
        f.write(f"-- For second day quota window after 00:00 UTC\n\n")
        for row in t2_rows:
            vals = [sql_escape(val) for val in row]
            f.write(f"INSERT OR IGNORE INTO prospect_records ({cols_joined}) VALUES ({', '.join(vals)});\n")

    print(f"Tranșa 2 generată: {len(t2_rows):,} rânduri.")
    print("Succes: ambele fișiere SQL au fost generate.")

    conn.close()

if __name__ == "__main__":
    main()
